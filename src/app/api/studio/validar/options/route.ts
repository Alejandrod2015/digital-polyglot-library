import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JOURNEY_CURRICULUM } from "@/app/journey/journeyCurriculum";

/**
 * GET /api/studio/validar/options
 *
 * Returns the data the /studio/validar page needs to render its cascading
 * dropdowns: real journeys from Prisma joined with the topic plan from
 * journeyCurriculum.ts. The client never has to know slugs or cuids; it
 * picks human-readable labels and we resolve everything internally.
 */

const LANGUAGE_TO_ISO: Record<string, string> = {
  spanish: "ES",
  german: "DE",
  italian: "IT",
  portuguese: "PT",
  french: "FR",
  english: "EN",
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const journeys = await prisma.journey.findMany({
    where: { status: { notIn: ["archived", "draft"] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      language: true,
      variant: true,
      levels: true,
    },
  });

  const result = journeys.map((j) => {
    const plan = JOURNEY_CURRICULUM.find(
      (p) =>
        p.language.toLowerCase() === j.language.toLowerCase() &&
        p.variantId.toLowerCase() === j.variant.toLowerCase()
    );

    const journeyLevels = plan
      ? plan.levels
          .filter((lvl) =>
            j.levels.some((jl) => jl.toLowerCase() === lvl.id.toLowerCase())
          )
          .map((lvl) => ({
            id: lvl.title.toUpperCase(),
            title: lvl.title,
            subtitle: lvl.subtitle,
            topics: lvl.topics.map((t) => ({ slug: t.slug, label: t.label })),
          }))
      : j.levels.map((lvlId) => ({
          id: lvlId.toUpperCase(),
          title: lvlId.toUpperCase(),
          subtitle: "",
          topics: [],
        }));

    return {
      id: j.id,
      name: j.name,
      language: j.language,
      languageCode: LANGUAGE_TO_ISO[j.language.toLowerCase()] ?? "",
      variant: j.variant,
      levels: journeyLevels,
    };
  });

  return NextResponse.json({ journeys: result });
}
