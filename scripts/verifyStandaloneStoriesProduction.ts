import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const HOST = process.env.READER_HOST ?? "https://reader.digitalpolyglot.com";

async function fetchWithStatus(url: string) {
  const t0 = Date.now();
  const res = await fetch(url, { redirect: "manual" });
  const elapsed = Date.now() - t0;
  return { status: res.status, body: await res.text(), elapsed };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const sample = await prisma.standaloneStory.findMany({
      where: { published: true },
      select: { slug: true, title: true, language: true, audioUrl: true, audio: true, vocab: true },
      orderBy: { sourceCreatedAt: "desc" },
    });

    const byLang = new Map<string, typeof sample[number]>();
    for (const s of sample) {
      const lang = s.language ?? "unknown";
      if (!byLang.has(lang)) byLang.set(lang, s);
    }
    const picks = Array.from(byLang.values()).slice(0, 8);

    console.log(`Picked ${picks.length} stories across languages: ${picks.map((p) => p.language).join(", ")}`);
    console.log("");

    console.log("--- 1. /stories/<slug> SSR ---");
    for (const p of picks) {
      const url = `${HOST}/stories/${encodeURIComponent(p.slug)}`;
      try {
        const { status, body, elapsed } = await fetchWithStatus(url);
        const titleEscaped = p.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const titleFound = body.includes(p.title) || body.includes(titleEscaped);
        console.log(
          `  ${status === 200 ? "✓" : "✗"} ${status}  ${elapsed}ms  title=${titleFound ? "✓" : "✗"}  ${p.slug}`
        );
      } catch (e) {
        console.log(`  ✗ ERR  ${p.slug}: ${(e as Error).message}`);
      }
    }

    console.log("");
    console.log("--- 2. /api/standalone-stories?slugs= (mobile API) ---");
    const slugCsv = picks.map((p) => p.slug).join(",");
    const url = `${HOST}/api/standalone-stories?slugs=${encodeURIComponent(slugCsv)}`;
    try {
      const { status, body, elapsed } = await fetchWithStatus(url);
      console.log(`  status=${status}  ${elapsed}ms`);
      if (status === 200) {
        const j = JSON.parse(body) as { stories?: Array<{ slug: string; title: string; language: string | null }> };
        const got = j.stories ?? [];
        console.log(`  returned ${got.length}/${picks.length} stories`);
        const gotSlugs = new Set(got.map((s) => s.slug));
        const missing = picks.filter((p) => !gotSlugs.has(p.slug));
        if (missing.length > 0) {
          console.log(`  MISSING:`);
          for (const m of missing) console.log(`    - ${m.slug}`);
        } else {
          console.log(`  ✓ all slugs returned`);
        }
        for (const s of got.slice(0, 3)) {
          console.log(`    sample: ${s.slug} | ${s.language} | ${s.title}`);
        }
      } else {
        console.log(`  body[0..200]: ${body.slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`  ✗ ERR: ${(e as Error).message}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
