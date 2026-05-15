/**
 * Audita la correspondencia entre ejercicios de práctica y segmentos de
 * audio aeneas. Para cada historia publicada de un journey:
 *   1. Construye los practice items igual que el endpoint /api/story-practice.
 *   2. Para cada item con audioClip, simula `findSegmentForClip` que usa
 *      el móvil (segmentId → targetWord → null).
 *   3. Reporta:
 *        - `ok`            : 1 segmento contiene el targetWord, match único.
 *        - `ambiguous`     : varios segmentos contienen el targetWord; la
 *                            heurística textual elige el de mayor solape
 *                            con `clip.sentence`. Puede ser el correcto o
 *                            no, pero el ejercicio depende del solape.
 *        - `no-segment`    : 0 segmentos contienen el targetWord; el audio
 *                            cae a HQ TTS y luego a expo-speech.
 *        - `short`/`long`  : el segmento elegido dura menos de 1 s o más de
 *                            8 s; suele indicar boundary mal aliñada.
 *
 * Usage:
 *   tsx scripts/auditPracticeAudio.ts <journeyId>
 *   tsx scripts/auditPracticeAudio.ts --language italian --variant italy
 *
 * Salida: tabla por consola. Útil para detectar items donde el audio
 * post-respuesta puede sonar movido o equivocado antes de que el usuario
 * lo note en sesión.
 */
import { prisma } from "../src/lib/prisma";
import { buildPracticeItemsFromStory, parseLooseVocab } from "../src/lib/storyPracticeItems";
import { buildPracticeSession, type PracticeFavoriteItem, type PracticeAudioClip } from "../src/lib/practiceExercises";
import { coerceAudioWordTimings } from "../src/lib/audioWordTimings";

type Segment = { id: string; text: string; normalizedText?: string; startSec: number; endSec: number };

function normalize(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

function findSegmentByTargetWord(
  segments: Segment[],
  targetWord: string,
  contextSentence: string,
): { match: Segment | null; candidates: Segment[]; reason: "unique" | "ambiguous" | "none" } {
  const word = normalize(targetWord);
  if (!word) return { match: null, candidates: [], reason: "none" };
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "i");
  const candidates = segments.filter((s) => pattern.test(s.normalizedText || s.text));
  if (candidates.length === 0) return { match: null, candidates, reason: "none" };
  if (candidates.length === 1) return { match: candidates[0], candidates, reason: "unique" };
  // disambiguate by overlap with context
  const ctx = normalize(contextSentence);
  const ctxTokens = new Set(ctx.split(/[^\p{L}\p{M}]+/u).filter(Boolean));
  let best = candidates[0];
  let bestScore = -1;
  for (const seg of candidates) {
    const segTokens = (seg.normalizedText || seg.text || "")
      .toLowerCase()
      .split(/[^\p{L}\p{M}]+/u)
      .filter(Boolean);
    const overlap = segTokens.filter((t) => ctxTokens.has(t)).length;
    if (overlap > bestScore) { best = seg; bestScore = overlap; }
  }
  return { match: best, candidates, reason: "ambiguous" };
}

function flagBoundary(seg: Segment): "ok" | "short" | "long" {
  const dur = seg.endSec - seg.startSec;
  if (dur < 1.0) return "short";
  if (dur > 8.0) return "long";
  return "ok";
}

async function auditStory(storyId: string): Promise<void> {
  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story?.text || !story?.title || !story?.slug) return;

  const segments = (story.audioSegments as Segment[] | null) ?? [];
  if (segments.length === 0) {
    console.log(`\n${story.slug}  [SKIP] no audioSegments`);
    return;
  }

  const timings = coerceAudioWordTimings(story.audioWordTimings ?? null);
  const items: PracticeFavoriteItem[] = buildPracticeItemsFromStory({
    title: story.title,
    slug: story.slug,
    text: story.text,
    language: story.journey.language,
    sourcePath: `/stories/${story.slug}`,
    vocab: parseLooseVocab(story.vocab),
    practiceSource: "curriculum",
    voiceId: story.voiceId ?? null,
    audioWordTimings: timings,
  });

  // Build "context" mode exercises (fill_blank) which are the ones that
  // play HQ audio on reveal. Meaning/listening also have audio but it
  // fires pre-reveal, which has a different match flow not in scope here.
  const exercises = buildPracticeSession(items, "context");
  const audited = exercises.filter((ex): ex is typeof ex & { audioClip: PracticeAudioClip; answer: string } => {
    return (ex.type === "fill_blank" || ex.type === "meaning_in_context" || ex.type === "natural_expression") && !!ex.audioClip;
  });

  console.log(`\n=== ${story.title}  (${story.slug}) ===`);
  console.log(`vocab items: ${items.length}, exercises built: ${exercises.length}, segments: ${segments.length}, exercises with audio: ${audited.length}`);

  let preciseCount = 0, heuristicUniqueCount = 0, heuristicAmbigCount = 0, noMatchCount = 0;
  for (const ex of audited) {
    const clip = ex.audioClip as PracticeAudioClip;
    const word = clip.targetWord ?? "";
    const hasPreciseRange =
      typeof clip.audioSentenceStartSec === "number" &&
      typeof clip.audioSentenceEndSec === "number" &&
      clip.audioSentenceEndSec > clip.audioSentenceStartSec;
    if (hasPreciseRange) {
      preciseCount += 1;
      console.log(
        `  [PRECISE              ] word=${word.padEnd(16)} → ${clip.audioSentenceStartSec!.toFixed(2)}-${clip.audioSentenceEndSec!.toFixed(2)} (word ${clip.audioWordStartSec?.toFixed(2)}-${clip.audioWordEndSec?.toFixed(2)})`
      );
      continue;
    }
    // No precise range available; fall through to legacy heuristic to
    // see whether the mobile fuzzy matcher would have found something.
    const result = findSegmentByTargetWord(segments, word, clip.sentence);
    const seg = result.match;
    let tag = "";
    if (result.reason === "unique") { tag = "HEUR-UNIQUE"; heuristicUniqueCount += 1; }
    else if (result.reason === "ambiguous") { tag = `HEUR-AMBIG (${result.candidates.length})`; heuristicAmbigCount += 1; }
    else { tag = "NO-MATCH (TTS fallback)"; noMatchCount += 1; }
    const segLabel = seg ? `${seg.id} ${seg.startSec.toFixed(2)}-${seg.endSec.toFixed(2)} ${seg.text.slice(0, 50)}` : "—";
    console.log(`  [${tag.padEnd(22)}] word=${word.padEnd(16)} → ${segLabel}`);
  }
  console.log(
    `summary: precise=${preciseCount} heur-unique=${heuristicUniqueCount} heur-ambig=${heuristicAmbigCount} no-match=${noMatchCount}`
  );
}

async function main() {
  const args = process.argv.slice(2);
  const journeyIdArg = args.find((a) => !a.startsWith("--"));
  const langArg = args.find((a) => a.startsWith("--language="))?.split("=")[1];
  const variantArg = args.find((a) => a.startsWith("--variant="))?.split("=")[1];

  let storyIds: string[] = [];
  if (journeyIdArg) {
    const stories = await prisma.journeyStory.findMany({
      where: { journeyId: journeyIdArg, status: "published" },
      select: { id: true },
      orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
    });
    storyIds = stories.map((s) => s.id);
  } else if (langArg) {
    const stories = await prisma.journeyStory.findMany({
      where: {
        status: "published",
        journey: {
          language: { equals: langArg, mode: "insensitive" },
          ...(variantArg ? { variant: { equals: variantArg, mode: "insensitive" } } : {}),
        },
      },
      select: { id: true },
      orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
    });
    storyIds = stories.map((s) => s.id);
  } else {
    console.error("Usage: tsx scripts/auditPracticeAudio.ts <journeyId>");
    console.error("       tsx scripts/auditPracticeAudio.ts --language italian [--variant italy]");
    process.exit(2);
  }

  console.log(`Auditing ${storyIds.length} stories…`);
  for (const id of storyIds) {
    try { await auditStory(id); } catch (err) {
      console.error(`Failed audit ${id}:`, err);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
