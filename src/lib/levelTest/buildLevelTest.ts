import { prisma } from "@/lib/prisma";
import type { LevelTestPayload, LevelTestRung, LevelTestStation } from "@domain/levelTest";
import { resolveStation, type StationProblem } from "./resolveStation";
import { spanishStationsForVariant } from "./stations.es";

/** Languages with an authored listening test. Mobile sends the display
 *  name ("Spanish"); the DB stores it lower case. */
const LANGUAGE_BY_DISPLAY: Record<string, string> = { spanish: "spanish" };

export function hasListeningLevelTest(language: string | null | undefined): boolean {
  return Boolean(language && LANGUAGE_BY_DISPLAY[language.toLowerCase()]);
}

/**
 * The full test for a language and variant, read from the live catalogue.
 * Stations whose story is no longer live, has lost its audio or its gloss
 * are left out and reported in `problems`; the ladder keeps every rung
 * that still has at least one station.
 */
export async function buildLevelTest(
  language: string,
  variant: string | null | undefined
): Promise<{ payload: LevelTestPayload; problems: StationProblem[] } | null> {
  const dbLanguage = LANGUAGE_BY_DISPLAY[language.toLowerCase()];
  if (!dbLanguage) return null;
  const authored = spanishStationsForVariant(variant);
  const resolvedVariant = authored === spanishStationsForVariant("spain") ? "spain" : "latam";

  const stories = await prisma.journeyStory.findMany({
    where: {
      slug: { in: authored.stations.map((s) => s.storySlug) },
      audioUrl: { not: null },
      journey: { status: "active", language: dbLanguage },
    },
    select: { slug: true, title: true, audioFragments: true, vocab: true },
  });
  const bySlug = new Map(stories.filter((s) => s.slug).map((s) => [s.slug as string, s]));

  const stations: LevelTestStation[] = [];
  const problems: StationProblem[] = [];
  for (const station of authored.stations) {
    const story = bySlug.get(station.storySlug);
    if (!story) {
      problems.push({ stationId: station.id, reason: `story "${station.storySlug}" not live with audio` });
      continue;
    }
    const result = resolveStation(station, {
      slug: story.slug ?? station.storySlug,
      title: story.title ?? "",
      audioFragments: story.audioFragments,
      vocab: story.vocab,
    });
    if ("problem" in result) problems.push(result.problem);
    else stations.push(result.station);
  }

  const ladder: LevelTestRung[] = authored.ladder.filter((level) =>
    stations.some((s) => s.level === level)
  );

  return {
    payload: { language, variant: resolvedVariant, ladder, stations },
    problems,
  };
}
