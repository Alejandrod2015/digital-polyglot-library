/**
 * scripts/storyClaude.ts
 *
 * Companion script for the `generate-story` skill. Lets Claude Code
 * generate JourneyStory content without going through the OpenAI-backed
 * Studio endpoints — Claude reads the journey context, produces the
 * story JSON in-conversation, and this script saves it to the DB.
 *
 * Usage:
 *   tsx scripts/storyClaude.ts context <storyId>
 *   tsx scripts/storyClaude.ts pending <journeyId>
 *   tsx scripts/storyClaude.ts save    <storyId> <pathToJson>
 *
 * The DATABASE_URL must be in the environment (load .env beforehand).
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { generateSlug } from "../src/agents/content/tools";
import { validateVocabAgainstText } from "../src/lib/vocabSurfaceValidation";

const prisma = new PrismaClient();

type ContextRow = {
  title: string | null;
  synopsis: string | null;
  text: string | null;
  topic: string;
};

async function loadContext(storyId: string): Promise<void> {
  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) {
    process.stderr.write(`Story ${storyId} not found\n`);
    process.exit(1);
  }

  const siblings = await prisma.journeyStory.findMany({
    where: { journeyId: story.journeyId, id: { not: storyId } },
    select: { title: true, synopsis: true, text: true, topic: true },
    orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
  });

  const existingTitles = (siblings as ContextRow[])
    .map((s) => s.title?.trim() ?? "")
    .filter(Boolean);

  const existingSynopses = (siblings as ContextRow[])
    .filter((s) => s.title && s.synopsis)
    .map((s) => ({ title: s.title!.trim(), synopsis: s.synopsis!.trim() }));

  const sameTopicTexts = (siblings as ContextRow[])
    .filter((s) => s.topic === story.topic && s.text)
    .map((s) => ({ title: s.title?.trim() ?? "", text: s.text!.trim() }));

  const allJourneyTexts = (siblings as ContextRow[])
    .filter((s) => s.text)
    .map((s) => s.text!.trim());

  const out = {
    storyId: story.id,
    slot: {
      level: story.level,
      topic: story.topic,
      slotIndex: story.slotIndex,
      currentTitle: story.title,
      currentSynopsis: story.synopsis,
    },
    journey: {
      id: story.journey.id,
      language: story.journey.language,
      variant: story.journey.variant,
      name: story.journey.name,
    },
    existingTitles,
    existingSynopses,
    sameTopicTexts,
    journeyTextsForCharacterExtraction: allJourneyTexts,
  };

  process.stdout.write(JSON.stringify(out, null, 2));
}

type StoryPayload = {
  title?: unknown;
  synopsis?: unknown;
  text?: unknown;
  vocab?: unknown;
};

type VocabItem = {
  word: string;
  surface?: string;
  definition: string;
  type?: string;
};

function validatePayload(raw: unknown): {
  title: string;
  synopsis: string;
  text: string;
  vocab: VocabItem[];
} {
  if (!raw || typeof raw !== "object") {
    throw new Error("Payload must be a JSON object.");
  }
  const p = raw as StoryPayload;
  const title = typeof p.title === "string" ? p.title.trim() : "";
  const synopsis = typeof p.synopsis === "string" ? p.synopsis.trim() : "";
  const text = typeof p.text === "string" ? p.text.trim() : "";
  if (!title) throw new Error("Missing or empty `title`.");
  if (!synopsis) throw new Error("Missing or empty `synopsis`.");
  if (!text) throw new Error("Missing or empty `text`.");
  if (!Array.isArray(p.vocab)) throw new Error("`vocab` must be an array.");

  const seen = new Set<string>();
  const vocab: VocabItem[] = [];
  for (const item of p.vocab as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const v = item as Record<string, unknown>;
    const word = typeof v.word === "string" ? v.word.trim() : "";
    const definition = typeof v.definition === "string" ? v.definition.trim() : "";
    if (!word || !definition) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const surface = typeof v.surface === "string" && v.surface.trim() ? v.surface.trim() : undefined;
    const type = typeof v.type === "string" && v.type.trim() ? v.type.trim() : undefined;
    vocab.push({
      word,
      ...(surface && surface !== word ? { surface } : {}),
      definition,
      ...(type ? { type } : {}),
    });
  }
  if (vocab.length < 15) {
    throw new Error(`Vocab must have at least 15 valid items, got ${vocab.length}.`);
  }

  // Surface-in-text gate: every vocab item must appear as a literal token
  // in the story body, otherwise computePracticeAudioRanges can't resolve
  // a deterministic audio range and the exercise falls back to TTS.
  const surfaceCheck = validateVocabAgainstText(vocab, text);
  if (!surfaceCheck.ok) {
    const lines = surfaceCheck.issues.map((i) => {
      const hint = i.suggestion ? ` → did you mean surface="${i.suggestion}"?` : "";
      return `  - "${i.word}" (surface="${i.declaredSurface}") not found in text${hint}`;
    });
    throw new Error(
      `Vocab surface gate failed (${surfaceCheck.issues.length} items missing from text):\n${lines.join("\n")}`,
    );
  }

  return { title, synopsis, text, vocab };
}

async function saveStory(storyId: string, jsonPath: string): Promise<void> {
  const raw = readFileSync(jsonPath, "utf8");
  const parsed = JSON.parse(raw);
  const { title, synopsis, text, vocab } = validatePayload(parsed);

  // Optional arcType: declared by the assistant per docs/story-quality-spec.md.
  // Validated against the closed enum so a typo can't slip into the DB.
  // 2026-07-07: sincronizado con la taxonomía kishōtenketsu de 7 arcos
  // (spec §Arc archetype); la lista vieja de 9 arcos quedó retirada en
  // 2026-06-02 pero este script no se migró.
  const ARC_TYPES = new Set([
    "reframe-turn",
    "juxtaposition-discovery",
    "harmonic-close",
    "mini-cliffhanger",
    "recurring-character-callback",
    "late-reveal",
    "daily-encounter",
  ]);
  const rawArc = typeof parsed.arcType === "string" ? parsed.arcType.trim() : "";
  if (rawArc && !ARC_TYPES.has(rawArc)) {
    throw new Error(
      `arcType "${rawArc}" is not in the allowed set. Allowed: ${Array.from(ARC_TYPES).join(", ")}`
    );
  }
  const arcType = rawArc || null;

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) throw new Error(`Story ${storyId} not found.`);

  // Orthography gate (2026-07-06): title/synopsis/text solo pueden usar el
  // alfabeto del idioma del journey. Nombres propios incluidos: "Ayşe" en una
  // historia alemana se coló hasta el reader y el usuario lo marcó como error
  // grave ("solo nombres y escritura del idioma"). El gate lo vuelve imposible.
  const LANGUAGE_LETTERS: Record<string, string> = {
    german: "ÄÖÜäöüß",
    spanish: "ÁÉÍÓÚÜÑáéíóúüñ",
    italian: "ÀÈÉÌÍÎÒÓÙàèéìíîòóù",
    portuguese: "ÁÂÃÀÇÉÊÍÓÔÕÚáâãàçéêíóôõú",
    french: "ÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸàâæçéèêëîïôœùûüÿ",
    english: "",
  };
  const extraLetters = LANGUAGE_LETTERS[story.journey.language];
  if (extraLetters !== undefined) {
    const offenders = new Map<string, string>();
    for (const [field, value] of [["title", title], ["synopsis", synopsis], ["text", text]] as const) {
      for (const ch of value) {
        if (/\p{L}/u.test(ch) && !/[A-Za-z]/.test(ch) && !extraLetters.includes(ch)) {
          if (!offenders.has(ch)) {
            const idx = value.indexOf(ch);
            offenders.set(ch, `${field}: "...${value.slice(Math.max(0, idx - 20), idx + 20)}..."`);
          }
        }
      }
    }
    if (offenders.size > 0) {
      const lines = Array.from(offenders.entries()).map(([ch, ctx]) => `  - "${ch}" en ${ctx}`);
      throw new Error(
        `Orthography gate failed: caracteres fuera del alfabeto de ${story.journey.language}.\n` +
        `Solo nombres y escritura del idioma del journey (regla del usuario 2026-07-06).\n${lines.join("\n")}`,
      );
    }
  }

  // Dialogue-ratio gate (2026-07-06): default permanente 70% diálogo / 30%
  // narrador. Solo aplica a historias multivoz (si hay 0 líneas "Speaker:",
  // es narrator-style y el gate se salta). Piso duro 65% para dar margen.
  // Origen: las 3 primeras C1 alemanas salieron 44-61% y hubo que reescribir.
  {
    const speakerRe = /^[A-ZÄÖÜ][\wäöüß]*(?:\s[A-ZÄÖÜ][\wäöüß]*)?:\s/;
    let dialogWords = 0;
    let narrWords = 0;
    for (const para of text.split(/\n\s*\n/)) {
      const t = para.trim();
      if (!t) continue;
      const w = t.split(/\s+/).length;
      if (speakerRe.test(t)) dialogWords += w;
      else narrWords += w;
    }
    if (dialogWords > 0) {
      const ratio = dialogWords / (dialogWords + narrWords);
      if (ratio < 0.65) {
        throw new Error(
          `Dialogue-ratio gate failed: ${(ratio * 100).toFixed(0)}% diálogo (piso 65%, default 70/30). ` +
          `Convierte beats narrativos en intercambios antes de guardar.`,
        );
      }
    }

    // Turn-length gate (2026-07-06): ningún turno de diálogo > 30 palabras.
    // Un turno de 40 palabras con tres oraciones expositivas es monólogo, no
    // conversación ("ritmo conversacional real" del spec, ahora cuantificado).
    // Partir la exposición larga con reacciones del interlocutor.
    const longTurns: string[] = [];
    for (const para of text.split(/\n\s*\n/)) {
      const m = para.trim().match(/^([A-ZÄÖÜ][\wäöüß]*(?:\s[A-ZÄÖÜ][\wäöüß]*)?):\s*([\s\S]+)$/);
      if (!m) continue;
      const w = m[2].split(/\s+/).length;
      if (w > 30) longTurns.push(`  - ${m[1]}: ${w} palabras ("${m[2].slice(0, 60)}...")`);
    }
    if (longTurns.length > 0) {
      throw new Error(
        `Turn-length gate failed: ${longTurns.length} turno(s) sobre 30 palabras.\n${longTurns.join("\n")}\n` +
        `Parte la exposición con una reacción o pregunta del interlocutor.`,
      );
    }
  }

  // Vocab type-balance gate (2026-07-06, niveles B2+): mínimo 2 expressions
  // por historia y nouns <= 45% duro (target ~40%). Origen: topic de llegada
  // C1 alemán salió con expressions 4→1→0 y una historia 52% sustantivos.
  if (["b2", "c1", "c2"].includes(story.level)) {
    const exprCount = vocab.filter((v) => v.type === "expression").length;
    const nounShare = vocab.filter((v) => v.type === "noun").length / vocab.length;
    if (exprCount < 2) {
      throw new Error(
        `Type-balance gate failed: ${exprCount} expression(s), mínimo 2 en B2+. ` +
        `Las expresiones idiomáticas son la adquisición más escasa del nivel avanzado.`,
      );
    }
    if (nounShare > 0.45) {
      throw new Error(
        `Type-balance gate failed: ${(nounShare * 100).toFixed(0)}% nouns (techo duro 45%, target ~40%). ` +
        `Cambia objetos concretos por verbos/expresiones transferibles.`,
      );
    }
  }

  const baseSlug = generateSlug(title, story.journey.language, story.journey.variant, 0).replace(/-0$/, "");
  const slug = story.slotIndex > 0 ? `${baseSlug}-${story.slotIndex + 1}` : baseSlug;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const updated = await prisma.journeyStory.update({
    where: { id: storyId },
    data: {
      status: "generated",
      title,
      slug,
      text,
      synopsis,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vocab: vocab as any,
      wordCount,
      vocabCount: vocab.length,
      arcType,
      auditScore: null,
      auditOffenders: undefined,
      auditedAt: null,
      error: null,
    },
  });

  process.stdout.write(JSON.stringify({
    id: updated.id,
    title: updated.title,
    slug: updated.slug,
    wordCount: updated.wordCount,
    vocabCount: updated.vocabCount,
    arcType: updated.arcType,
    status: updated.status,
  }, null, 2));
}

async function listPending(journeyId: string): Promise<void> {
  const journey = await prisma.journey.findUnique({ where: { id: journeyId } });
  if (!journey) {
    process.stderr.write(`Journey ${journeyId} not found\n`);
    process.exit(1);
  }

  const drafts = await prisma.journeyStory.findMany({
    where: { journeyId, status: "draft" },
    select: { id: true, level: true, topic: true, slotIndex: true },
    orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
  });

  process.stdout.write(JSON.stringify({
    journey: { id: journey.id, language: journey.language, variant: journey.variant, name: journey.name },
    pendingCount: drafts.length,
    pending: drafts.map((d) => ({ storyId: d.id, level: d.level, topic: d.topic, slotIndex: d.slotIndex })),
  }, null, 2));
}

async function main() {
  const [, , cmd, ...args] = process.argv;
  if (cmd === "context") {
    if (!args[0]) { process.stderr.write("usage: storyClaude.ts context <storyId>\n"); process.exit(2); }
    await loadContext(args[0]);
    return;
  }
  if (cmd === "pending") {
    if (!args[0]) { process.stderr.write("usage: storyClaude.ts pending <journeyId>\n"); process.exit(2); }
    await listPending(args[0]);
    return;
  }
  if (cmd === "save") {
    if (!args[0] || !args[1]) { process.stderr.write("usage: storyClaude.ts save <storyId> <pathToJson>\n"); process.exit(2); }
    await saveStory(args[0], args[1]);
    return;
  }
  process.stderr.write("usage: storyClaude.ts [context|pending|save] ...\n");
  process.exit(2);
}

main()
  .catch((err) => { process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`); process.exit(1); })
  .finally(() => prisma.$disconnect());
