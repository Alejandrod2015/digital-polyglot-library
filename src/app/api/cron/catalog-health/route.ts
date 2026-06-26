// /api/cron/catalog-health
//
// Daily smoke test that the Sanity -> Studio migration is still holding.
// Triggered by a Vercel cron (see vercel.json) and also callable manually.
// Returns 200 + ok:true on every healthy check; returns 500 + ok:false on
// the first divergence so Vercel surfaces the failure in the cron logs.
//
// What it checks:
//   1. Catalog row counts in Prisma match the baseline established at the
//      cutover (Sanity is no longer the source of truth, so any drop is a
//      regression; additions are fine).
//   2. The mobile API responds with X-Catalog-Source: studio (proving the
//      runtime is reading from Prisma, not Sanity).
//   3. A sample story slug can be loaded server-side from the reader page
//      and via the mobile API end-to-end.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CATALOG_BOOK_MIN = 4;
const CATALOG_STORY_MIN = 80;
const STANDALONE_PUBLISHED_MIN = 35;

type CheckResult = { name: string; ok: boolean; detail?: string };

async function checkCounts(): Promise<CheckResult[]> {
  const [books, stories, standalone, standalonePublished] = await Promise.all([
    prisma.catalogBook.count(),
    prisma.catalogStory.count(),
    prisma.standaloneStory.count(),
    prisma.standaloneStory.count({ where: { published: true } }),
  ]);
  return [
    {
      name: "catalog_book_count",
      ok: books >= CATALOG_BOOK_MIN,
      detail: `${books} (min ${CATALOG_BOOK_MIN})`,
    },
    {
      name: "catalog_story_count",
      ok: stories >= CATALOG_STORY_MIN,
      detail: `${stories} (min ${CATALOG_STORY_MIN})`,
    },
    {
      name: "standalone_total",
      ok: standalone >= STANDALONE_PUBLISHED_MIN,
      detail: `${standalone} total, ${standalonePublished} published`,
    },
    {
      name: "standalone_published",
      ok: standalonePublished >= STANDALONE_PUBLISHED_MIN,
      detail: `${standalonePublished} (min ${STANDALONE_PUBLISHED_MIN})`,
    },
  ];
}

async function pickSampleSlug(): Promise<string | null> {
  const row = await prisma.standaloneStory.findFirst({
    where: { published: true },
    select: { slug: true },
    orderBy: { sourceCreatedAt: "asc" },
  });
  return row?.slug ?? null;
}

async function checkApiSource(host: string, slug: string): Promise<CheckResult> {
  const url = `${host}/api/standalone-stories?slugs=${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const source = res.headers.get("x-catalog-source");
    if (!res.ok) {
      return { name: "api_status", ok: false, detail: `status=${res.status}` };
    }
    return {
      name: "api_source_header",
      ok: source === "studio",
      detail: `x-catalog-source=${source ?? "(missing)"}`,
    };
  } catch (e) {
    return { name: "api_source_header", ok: false, detail: (e as Error).message };
  }
}

async function checkApiReturnsSlug(host: string, slug: string): Promise<CheckResult> {
  const url = `${host}/api/standalone-stories?slugs=${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { name: "api_returns_slug", ok: false, detail: `status=${res.status}` };
    const data = (await res.json()) as { stories?: Array<{ slug: string }> };
    const got = data.stories ?? [];
    const found = got.some((s) => s.slug === slug);
    return {
      name: "api_returns_slug",
      ok: found,
      detail: found ? `returned ${got.length}` : `slug ${slug} not in ${got.length} results`,
    };
  } catch (e) {
    return { name: "api_returns_slug", ok: false, detail: (e as Error).message };
  }
}

async function checkSsr(host: string, slug: string): Promise<CheckResult> {
  const url = `${host}/stories/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, { redirect: "manual", cache: "no-store" });
    return {
      name: "ssr_status",
      ok: res.status === 200,
      detail: `status=${res.status}`,
    };
  } catch (e) {
    return { name: "ssr_status", ok: false, detail: (e as Error).message };
  }
}

export async function GET(req: Request) {
  const t0 = Date.now();
  const host =
    process.env.APP_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    new URL(req.url).origin;

  const checks: CheckResult[] = [];

  try {
    checks.push(...(await checkCounts()));

    const slug = await pickSampleSlug();
    if (!slug) {
      checks.push({
        name: "sample_slug",
        ok: false,
        detail: "no published StandaloneStory found",
      });
    } else {
      const [api, returnedSlug, ssr] = await Promise.all([
        checkApiSource(host, slug),
        checkApiReturnsSlug(host, slug),
        checkSsr(host, slug),
      ]);
      checks.push(api, returnedSlug, ssr);
    }

    const ok = checks.every((c) => c.ok);
    const durationMs = Date.now() - t0;
    const payload = { ok, host, sample: await pickSampleSlug(), durationMs, checks };
    return NextResponse.json(payload, { status: ok ? 200 : 500 });
  } catch (err) {
    const durationMs = Date.now() - t0;
    return NextResponse.json(
      {
        ok: false,
        host,
        durationMs,
        checks,
        error: (err as Error).message,
      },
      { status: 500 }
    );
  }
}
