// Sweeps every published StandaloneStory in Studio against production and
// reports any discrepancy. Hits both the SSR reader route and the mobile API.
//
// Useful to run after activating READ_STANDALONE_STORIES_FROM_STUDIO=true to
// catch regressions before the user does.

import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const HOST = process.env.READER_HOST ?? "https://reader.digitalpolyglot.com";

type SsrResult =
  | { kind: "ok"; status: number; ms: number; titleFound: boolean }
  | { kind: "non200"; status: number; ms: number; bodySnippet: string }
  | { kind: "error"; error: string };

async function probeSsr(slug: string, expectedTitle: string): Promise<SsrResult> {
  const url = `${HOST}/stories/${encodeURIComponent(slug)}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, { redirect: "manual" });
    const ms = Date.now() - t0;
    if (res.status !== 200) {
      const body = await res.text();
      return { kind: "non200", status: res.status, ms, bodySnippet: body.slice(0, 120) };
    }
    const body = await res.text();
    const escaped = expectedTitle
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const titleFound = body.includes(expectedTitle) || body.includes(escaped);
    return { kind: "ok", status: 200, ms, titleFound };
  } catch (e) {
    return { kind: "error", error: (e as Error).message };
  }
}

type ApiStory = {
  slug: string;
  title: string;
  language: string | null;
  cefrLevel: string | null;
  audioUrl: string | null;
  coverUrl: string | null;
  vocabRaw: string | null;
};

async function probeMobileApiBatch(slugs: string[]): Promise<{ status: number; ms: number; stories: ApiStory[] }> {
  const url = `${HOST}/api/standalone-stories?slugs=${encodeURIComponent(slugs.join(","))}`;
  const t0 = Date.now();
  const res = await fetch(url, { redirect: "manual" });
  const ms = Date.now() - t0;
  if (res.status !== 200) {
    return { status: res.status, ms, stories: [] };
  }
  const j = (await res.json()) as { stories?: ApiStory[] };
  return { status: 200, ms, stories: j.stories ?? [] };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const published = await prisma.standaloneStory.findMany({
      where: { published: true },
      orderBy: { sourceCreatedAt: "asc" },
      select: { slug: true, title: true, language: true, cefrLevel: true, audio: true, audioUrl: true, cover: true, coverUrl: true, vocab: true, sourceType: true },
    });

    console.log(`Host: ${HOST}`);
    console.log(`Published stories to sweep: ${published.length}`);
    console.log("");
    console.log("--- 1. SSR /stories/<slug> ---");

    const ssrFailures: Array<{ slug: string; reason: string }> = [];
    let ssrOk = 0;
    let titleMismatches = 0;
    for (const s of published) {
      const r = await probeSsr(s.slug, s.title);
      if (r.kind === "ok" && r.titleFound) {
        ssrOk++;
      } else if (r.kind === "ok" && !r.titleFound) {
        titleMismatches++;
        ssrFailures.push({ slug: s.slug, reason: `200 but title not in body` });
      } else if (r.kind === "non200") {
        ssrFailures.push({ slug: s.slug, reason: `status=${r.status} body=${r.bodySnippet}` });
      } else {
        ssrFailures.push({ slug: s.slug, reason: `ERR ${r.error}` });
      }
    }
    console.log(`  ✓ ${ssrOk}/${published.length} 200 with title`);
    if (titleMismatches > 0) console.log(`  ! ${titleMismatches} returned 200 but did not include the expected title (possibly hydrated client-side)`);
    if (ssrFailures.length > 0) {
      console.log("  failures:");
      for (const f of ssrFailures.slice(0, 12)) console.log(`    - ${f.slug}: ${f.reason}`);
      if (ssrFailures.length > 12) console.log(`    ...and ${ssrFailures.length - 12} more`);
    }
    console.log("");

    console.log("--- 2. /api/standalone-stories?slugs=<all> ---");
    const allSlugs = published.map((s) => s.slug);
    const batch = await probeMobileApiBatch(allSlugs);
    console.log(`  status=${batch.status}  ${batch.ms}ms  returned=${batch.stories.length}/${allSlugs.length}`);

    const returnedSlugs = new Set(batch.stories.map((s) => s.slug));
    const missing = allSlugs.filter((s) => !returnedSlugs.has(s));
    if (missing.length > 0) {
      console.log("  missing:");
      for (const m of missing.slice(0, 10)) console.log(`    - ${m}`);
      if (missing.length > 10) console.log(`    ...and ${missing.length - 10} more`);
    } else {
      console.log("  ✓ all expected slugs returned");
    }

    // Field-level checks: audio, cover, vocab presence per story.
    const apiBySlug = new Map(batch.stories.map((s) => [s.slug, s]));
    const fieldIssues: Array<{ slug: string; issue: string }> = [];
    for (const s of published) {
      const api = apiBySlug.get(s.slug);
      if (!api) continue;
      const studioHasAudio = Boolean(s.audioUrl) || Boolean(s.audio);
      const apiHasAudio = Boolean(api.audioUrl);
      if (studioHasAudio !== apiHasAudio) {
        fieldIssues.push({ slug: s.slug, issue: `audio drift: studio=${studioHasAudio} api=${apiHasAudio}` });
      }
      const studioHasCover = Boolean(s.coverUrl) || Boolean(s.cover);
      const apiHasCover = Boolean(api.coverUrl);
      if (studioHasCover !== apiHasCover) {
        fieldIssues.push({ slug: s.slug, issue: `cover drift: studio=${studioHasCover} api=${apiHasCover}` });
      }
      const studioHasVocab = Array.isArray(s.vocab) && (s.vocab as unknown[]).length > 0;
      const apiHasVocab = Boolean(api.vocabRaw && api.vocabRaw.trim());
      if (studioHasVocab !== apiHasVocab) {
        fieldIssues.push({ slug: s.slug, issue: `vocab drift: studio=${studioHasVocab} api=${apiHasVocab}` });
      }
    }
    if (fieldIssues.length === 0) {
      console.log("  ✓ field parity (audio/cover/vocab) holds for every returned story");
    } else {
      console.log(`  ! ${fieldIssues.length} field-level drifts:`);
      for (const f of fieldIssues.slice(0, 10)) console.log(`    - ${f.slug}: ${f.issue}`);
      if (fieldIssues.length > 10) console.log(`    ...and ${fieldIssues.length - 10} more`);
    }

    console.log("");
    console.log("--- 3. Coverage by language ---");
    const byLang = new Map<string, number>();
    for (const s of published) {
      const k = s.language ?? "(null)";
      byLang.set(k, (byLang.get(k) ?? 0) + 1);
    }
    for (const [lang, n] of byLang) console.log(`  ${lang}: ${n}`);

    console.log("");
    console.log("--- Summary ---");
    const ssrAllOk = ssrFailures.length === 0;
    const apiAllOk = missing.length === 0 && batch.status === 200;
    const fieldsOk = fieldIssues.length === 0;
    console.log(`  SSR:       ${ssrAllOk ? "PASS" : "FAIL"}  (${ssrOk}/${published.length} hits)`);
    console.log(`  Mobile API: ${apiAllOk ? "PASS" : "FAIL"}  (${batch.stories.length}/${allSlugs.length})`);
    console.log(`  Field parity: ${fieldsOk ? "PASS" : "FAIL"}  (${fieldIssues.length} drifts)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
