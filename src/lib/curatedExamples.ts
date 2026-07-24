import { prisma } from "@/lib/prisma";

/**
 * REUSO (2026-07-24): un favorito cuya palabra YA existe como ejercicio CURADO en
 * un journey vivo puede reusar la oración limpia + su clip ElevenLabs (audio ==
 * texto, verificado), en vez de la prosa cruda de la historia + slice del maestro.
 * Este helper mapea (idioma::palabra) → {oración curada, clipUrl EL, voiceId}.
 * Solo mira contenido PUBLICADO de journeys ACTIVOS. Prefiere la entrada que
 * tenga clip.
 */

export type CuratedExample = { sentence: string; clipUrl: string | null; voiceId: string | null };

export async function getCuratedExampleMap(
  pairs: Array<{ word: string; language: string | null | undefined }>,
): Promise<Map<string, CuratedExample>> {
  const words = [...new Set(pairs.map((p) => p.word?.trim().toLowerCase()).filter((w): w is string => !!w))];
  const langs = [...new Set(pairs.map((p) => p.language?.trim().toLowerCase()).filter((l): l is string => !!l))];
  if (!words.length || !langs.length) return new Map();

  const rows = await prisma.storyPracticeExercise.findMany({
    where: {
      word: { in: words, mode: "insensitive" },
      set: {
        story: {
          status: "published",
          journey: { status: { notIn: ["archived", "draft"] }, language: { in: langs, mode: "insensitive" } },
        },
      },
    },
    select: {
      word: true,
      sentence: true,
      payload: true,
      set: { select: { story: { select: { journey: { select: { language: true } } } } } },
    },
  });

  const map = new Map<string, CuratedExample>();
  for (const r of rows) {
    const lang = (r.set?.story?.journey?.language ?? "").trim().toLowerCase();
    const word = (r.word ?? "").trim().toLowerCase();
    if (!lang || !word) continue;
    const ac = (r.payload as Record<string, unknown> | null)?.audioClip as Record<string, unknown> | undefined;
    const clipUrl = typeof ac?.clipUrl === "string" ? ac.clipUrl : null;
    const sentence = (typeof ac?.sentence === "string" ? ac.sentence : r.sentence) ?? "";
    const voiceId = typeof ac?.voiceId === "string" ? ac.voiceId : null;
    if (!sentence) continue;
    const key = `${lang}::${word}`;
    const existing = map.get(key);
    if (!existing || (clipUrl && !existing.clipUrl)) map.set(key, { sentence, clipUrl, voiceId });
  }
  return map;
}

/** Key used by getCuratedExampleMap. */
export function curatedKey(language: string | null | undefined, word: string): string {
  return `${(language ?? "").trim().toLowerCase()}::${word.trim().toLowerCase()}`;
}
