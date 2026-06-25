export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getActiveMobileSession } from "@/lib/mobileSession";
import { prisma } from "@/lib/prisma";

/**
 * Returns the full Studio language catalog so the mobile language switcher
 * mirrors the Planning page. A language is `comingSoon` when there is no
 * active Journey record for it yet — the user can see it as a future option
 * but cannot pick it as a target language.
 *
 * Languages that have a Journey record but zero published stories (e.g. a new
 * "Conversacional" plan in Spanish) are NOT comingSoon: they show up with the
 * empty-topic placeholders the journey route already returns.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [languages, journeys] = await Promise.all([
    prisma.language.findMany({
      orderBy: { sortOrder: "asc" },
      include: { variants: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.journey.findMany({
      where: { status: { not: "archived" } },
      select: { language: true, variant: true },
    }),
  ]);

  const languagesWithJourneys = new Set(
    journeys.map((j) => j.language.trim().toLowerCase())
  );
  // Per-(language, variant) availability. A language can be live overall while
  // a specific variant has zero journeys (e.g. Spanish has LATAM content but
  // not Spain) — the picker must be able to disable just that variant.
  const journeyVariantPairs = new Set(
    journeys
      .filter((j) => j.variant)
      .map((j) => `${j.language.trim().toLowerCase()}:${j.variant!.trim().toLowerCase()}`)
  );

  const items = languages.map((lang) => {
    const langKey = lang.code.toLowerCase();
    const hasJourney = languagesWithJourneys.has(langKey);
    return {
      code: lang.code,
      label: lang.label,
      variants: lang.variants.map((v) => ({
        code: v.code,
        label: v.label,
        comingSoon: !journeyVariantPairs.has(`${langKey}:${v.code.trim().toLowerCase()}`),
      })),
      comingSoon: !hasJourney,
    };
  });

  return NextResponse.json({ languages: items });
}
