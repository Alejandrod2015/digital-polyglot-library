// Pure (client-safe) types + helpers para los word timings de audio
// karaoke. Vive separado de `audioWordTimings.ts` porque ese archivo
// importa `@/lib/prisma` (server-only) para los flujos de generación
// y alineamiento Modal. Cuando un client component como
// `HighlightedStoryReader.tsx` importa una función runtime de
// `audioWordTimings.ts`, webpack bundlea TODA la cadena transitiva al
// cliente — incluyendo prisma — y peta con "PrismaClient is unable
// to run in this browser environment".
//
// La regla: tipos + parsers/serializers de payload van acá. Cosas
// que tocan DB o Modal (generateWordTimingsForStory, alignAudioOnModal,
// etc.) viven en `audioWordTimings.ts`.

export const AUDIO_WORD_TIMINGS_VERSION = 1 as const;

export type StoryWordToken = {
  text: string;
  charStart: number;
  charEnd: number;
  startSec: number | null;
  endSec: number | null;
};

export type AudioWordTimingsPayload = {
  version: typeof AUDIO_WORD_TIMINGS_VERSION;
  audioDurationSec: number | null;
  storyPlainText: string;
  words: StoryWordToken[];
};

/**
 * Parse + validate raw JSON-shaped data into a typed payload. Returns
 * `null` si el shape no encaja, así el caller usa fallback al legacy
 * sentence-level path. Pure function — safe en client y server.
 */
export function coerceAudioWordTimings(raw: unknown): AudioWordTimingsPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== AUDIO_WORD_TIMINGS_VERSION) return null;
  if (typeof record.storyPlainText !== "string") return null;
  if (!Array.isArray(record.words)) return null;

  const words: StoryWordToken[] = [];
  for (const item of record.words) {
    if (!item || typeof item !== "object") continue;
    const w = item as Record<string, unknown>;
    if (typeof w.text !== "string") continue;
    if (typeof w.charStart !== "number" || typeof w.charEnd !== "number") continue;
    const startSec =
      typeof w.startSec === "number" && Number.isFinite(w.startSec) ? w.startSec : null;
    const endSec = typeof w.endSec === "number" && Number.isFinite(w.endSec) ? w.endSec : null;
    words.push({
      text: w.text,
      charStart: w.charStart,
      charEnd: w.charEnd,
      startSec,
      endSec,
    });
  }
  if (words.length === 0) return null;

  const audioDurationSec =
    typeof record.audioDurationSec === "number" && Number.isFinite(record.audioDurationSec)
      ? record.audioDurationSec
      : null;

  return {
    version: AUDIO_WORD_TIMINGS_VERSION,
    audioDurationSec,
    storyPlainText: record.storyPlainText,
    words,
  };
}
