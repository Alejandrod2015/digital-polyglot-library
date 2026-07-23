import { books } from "@/data/books";
import { splitStoryTextIntoSentences } from "@/lib/audioSegments";
import {
  getPracticeModeBias,
  sortPracticeItemsByOnboarding,
  type OnboardingPracticePrefs,
} from "@/lib/onboarding";
import { normalizeVocabType } from "@/lib/vocabTypes";
import { getSegmentIdFromSourcePath, getStorySource, isStandaloneSourcePath } from "@/lib/storySource";

export type PracticeFavoriteItem = {
  word: string;
  translation: string;
  wordType?: string | null;
  exampleSentence?: string | null;
  storySlug?: string | null;
  storyTitle?: string | null;
  sourcePath?: string | null;
  language?: string | null;
  nextReviewAt?: string | null;
  practiceSource?: "curriculum" | "user_saved" | "both" | null;
  /** Voice the source story was narrated with, when known. */
  voiceId?: string | null;
  /** Pre-baked practice sentence-clip URL for this word, joined server-side from
   *  the story's practice set (match por historia+palabra). Cuando existe, la
   *  oración de este favorito ya viene del MISMO registro que el clip, así que
   *  mostrar `exampleSentence` y reproducir `clipUrl` no pueden desincronizarse. */
  clipUrl?: string | null;
  /** Pre-computed exact audio ranges from the source story's aeneas
   *  word timings. When non-null, the mobile player skips fuzzy segment
   *  matching and plays the exact range from the story mp3. Null when
   *  the story has no aeneas alignment or the word doesn't appear as a
   *  literal token in the story plain text → fall back to HQ TTS. */
  audioWordStartSec?: number | null;
  audioWordEndSec?: number | null;
  audioSentenceStartSec?: number | null;
  audioSentenceEndSec?: number | null;
};

export type PracticeMode =
  | "meaning"
  | "context"
  | "listening"
  | "match";

export type FillBlankExercise = {
  id: string;
  type: "fill_blank";
  prompt: string;
  sentence: string;
  // Optional English gloss of the sentence, shown small/italic under it so A2
  // learners always understand the context. Curated sets may set it; the legacy
  // generator leaves it undefined.
  translation?: string | null;
  // Optional per-option English gloss, parallel to `options`. On reveal it shows
  // under each choice and fills the English `translation` blank with the answer's.
  optionTranslations?: string[] | null;
  storySlug?: string | null;
  audioClip?: PracticeAudioClip | null;
  options: string[];
  answer: string;
};

export type MeaningContextExercise = {
  id: string;
  type: "meaning_in_context";
  prompt: string;
  word: string;
  sentence: string;
  storySlug?: string | null;
  audioClip?: PracticeAudioClip | null;
  options: string[];
  answer: string;
};

export type ListenChooseExercise = {
  id: string;
  type: "listen_choose";
  prompt: string;
  speechText: string;
  language: string | null;
  options: string[];
  // Optional per-option English gloss, parallel to `options`; shown under each
  // choice on reveal (same as fill_blank).
  optionTranslations?: string[] | null;
  // Optional story audio segment to play instead of browser TTS — a real
  // sentence-level clip from the story master (clean boundaries).
  audioClip?: PracticeAudioClip | null;
  answer: string;
};

export type MatchMeaningExercise = {
  id: string;
  type: "match_meaning";
  prompt: string;
  pairs: Array<{
    word: string;
    answer: string;
    options: string[];
    // Metadatos de audio de la palabra, para reproducir el término
    // individual (mobile lo sintetiza vía /api/practice/sentence-tts).
    language?: string | null;
    voiceId?: string | null;
  }>;
};

export type PracticeAudioClip = {
  storySlug: string;
  sentence: string;
  storySource: "user" | "standalone";
  language?: string | null;
  targetWord?: string | null;
  segmentId?: string | null;
  /** Voice the source story was narrated with. Forwarded to the
   *  practice TTS endpoint so the audio clip uses the same voice as
   *  the reader (when it's a Piper voice the Modal app supports). */
  voiceId?: string | null;
  /** Pre-computed audio ranges. Mobile plays this exact range from the
   *  story mp3 when set, bypassing fuzzy segment matching. */
  audioWordStartSec?: number | null;
  audioWordEndSec?: number | null;
  audioSentenceStartSec?: number | null;
  audioSentenceEndSec?: number | null;
  /** Pre-rendered mp3 URL persisted in R2 for this exercise. When set,
   *  the mobile client plays this URL directly instead of calling the
   *  Modal Piper endpoint, eliminating cold-start failures. The editor
   *  (re)generates these from Studio via the regen-audio endpoint. */
  cachedUrl?: string | null;
  /** Explicit pre-trimmed clip URL to play start-to-finish for THIS clip
   *  (e.g. a single sentence carved out of a long narrator paragraph via
   *  Scribe timestamps). When set, the web player plays it directly and
   *  skips fragment matching / master slicing. */
  clipUrl?: string | null;
  /** Clip PRE-HORNEADO de la PALABRA objetivo (no la oración), en la voz del
   *  narrador. Se usa en modo `meaning`, donde debe sonar la palabra, no la
   *  oración (2026-07-23). Generado por scripts/_genWordClips.ts con gate F0.
   *  Cuando falta, el mobile cae a word-tts (la palabra, en runtime). */
  wordClipUrl?: string | null;
  /** Voz con la que se generó `wordClipUrl` (narrador del journey). */
  wordVoiceId?: string | null;
};

export type PracticeExercise =
  | FillBlankExercise
  | MeaningContextExercise
  | ListenChooseExercise
  | MatchMeaningExercise;

function normalizeText(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKey(value?: string | null): string {
  return normalizeText(value).toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function mergePracticeSource(
  current?: PracticeFavoriteItem["practiceSource"],
  incoming?: PracticeFavoriteItem["practiceSource"]
): PracticeFavoriteItem["practiceSource"] {
  if (current === "both" || incoming === "both") return "both";
  if (!current) return incoming ?? null;
  if (!incoming) return current;
  return current === incoming ? current : "both";
}

function pickPreferredValue(current?: string | null, incoming?: string | null): string | null | undefined {
  const currentText = normalizeText(current);
  const incomingText = normalizeText(incoming);
  if (!currentText) return incomingText || current || incoming;
  if (!incomingText) return current;
  return incomingText.length > currentText.length ? incoming : current;
}

function mergePracticeItem(current: PracticeFavoriteItem, incoming: PracticeFavoriteItem): PracticeFavoriteItem {
  const currentNextReviewAt = current.nextReviewAt ? Date.parse(current.nextReviewAt) : Number.NaN;
  const incomingNextReviewAt = incoming.nextReviewAt ? Date.parse(incoming.nextReviewAt) : Number.NaN;

  return {
    ...current,
    translation: pickPreferredValue(current.translation, incoming.translation) ?? current.translation,
    wordType: pickPreferredValue(current.wordType, incoming.wordType) ?? current.wordType,
    exampleSentence: pickPreferredValue(current.exampleSentence, incoming.exampleSentence) ?? current.exampleSentence,
    storySlug: pickPreferredValue(current.storySlug, incoming.storySlug) ?? current.storySlug,
    storyTitle: pickPreferredValue(current.storyTitle, incoming.storyTitle) ?? current.storyTitle,
    sourcePath: pickPreferredValue(current.sourcePath, incoming.sourcePath) ?? current.sourcePath,
    language: pickPreferredValue(current.language, incoming.language) ?? current.language,
    nextReviewAt:
      Number.isFinite(currentNextReviewAt) && Number.isFinite(incomingNextReviewAt)
        ? currentNextReviewAt <= incomingNextReviewAt
          ? current.nextReviewAt
          : incoming.nextReviewAt
        : current.nextReviewAt ?? incoming.nextReviewAt ?? null,
    practiceSource: mergePracticeSource(current.practiceSource, incoming.practiceSource),
  };
}

export function mergePracticeItemsByWord(items: PracticeFavoriteItem[]): PracticeFavoriteItem[] {
  const merged = new Map<string, PracticeFavoriteItem>();
  for (const item of items) {
    const key = `${normalizeKey(item.language)}::${normalizeKey(item.word)}`;
    if (!normalizeText(item.word)) continue;
    const existing = merged.get(key);
    merged.set(key, existing ? mergePracticeItem(existing, item) : item);
  }
  return Array.from(merged.values());
}

function uniqueByWord(items: PracticeFavoriteItem[]): PracticeFavoriteItem[] {
  return mergePracticeItemsByWord(items);
}

function inferCatalogPool(): PracticeFavoriteItem[] {
  const items: PracticeFavoriteItem[] = [];
  for (const book of Object.values(books)) {
    for (const story of book.stories ?? []) {
      for (const vocab of story.vocab ?? []) {
        const word = normalizeText(vocab.word);
        const translation = normalizeText(vocab.definition);
        if (!word || !translation) continue;
        items.push({
          word,
          translation,
          wordType:
            normalizeVocabType(vocab.type, {
              word,
              definition: translation,
            }) ?? null,
          exampleSentence: normalizeText(vocab.note) || null,
          storySlug: normalizeText(story.slug) || null,
          storyTitle: normalizeText(story.title) || null,
          sourcePath: `/books/${book.slug}/${story.slug}`,
          language: normalizeText(story.language || book.language) || null,
          practiceSource: "curriculum",
        });
      }
    }
  }
  return uniqueByWord(items);
}

const catalogPool = inferCatalogPool();

function getLanguagePool(
  language: string | null | undefined,
  source: PracticeFavoriteItem[]
): PracticeFavoriteItem[] {
  const key = normalizeKey(language);
  if (!key) return source;
  const filtered = source.filter((item) => normalizeKey(item.language) === key);
  return filtered.length > 0 ? filtered : source;
}

// Rough Spanish gender/number from the surface form (no gender data on items).
// Strip a leading article, drop a trailing plural "s", then read the ending:
// -a → feminine, -o → masculine; other endings are undecidable (null). Used
// only as a soft preference for distractor agreement, never a hard gate.
function spanishAgreement(raw: string): { gender: "f" | "m"; plural: boolean } | null {
  const w = raw
    .trim()
    .toLowerCase()
    .replace(/^(el|la|los|las|un|una|unos|unas)\s+/, "");
  if (!w || w.includes(" ")) return null;
  const plural = w.endsWith("s");
  const stem = plural ? w.slice(0, -1) : w;
  const last = stem.charAt(stem.length - 1);
  if (last === "a") return { gender: "f", plural };
  if (last === "o") return { gender: "m", plural };
  return null;
}

function getDistractorWords(
  item: PracticeFavoriteItem,
  pool: PracticeFavoriteItem[],
  max = 3
): string[] {
  // Distractores grammar-aware: si el target es "mit Nachdruck"
  // (frase preposicional) y los distractores son `Trubel` (sustantivo)
  // + `rühren` (verbo) + `Sichtweisen` (sustantivo plural), el usuario
  // resuelve por descarte gramatical, no por comprensión. Filtramos el
  // pool por (a) misma "forma" multi-word/single-word y (b) mismo
  // wordType normalizado cuando esté disponible. Si no hay suficientes
  // candidatos del mismo tipo, completamos con el pool general para no
  // dejar el ejercicio con menos de 4 opciones.
  const targetWord = normalizeText(item.word);
  const targetIsMultiword = targetWord.includes(" ");
  const targetType = normalizeVocabType(item.wordType, {
    word: item.word,
    definition: item.translation,
  });

  const eligible = uniqueByWord(
    pool.filter(
      (candidate) =>
        normalizeKey(candidate.word) !== normalizeKey(item.word) &&
        normalizeText(candidate.word)
    )
  );

  const sameShapeAndType = eligible.filter((candidate) => {
    const candidateIsMultiword = normalizeText(candidate.word).includes(" ");
    if (candidateIsMultiword !== targetIsMultiword) return false;
    if (!targetType) return true;
    const candidateType = normalizeVocabType(candidate.wordType, {
      word: candidate.word,
      definition: candidate.translation,
    });
    return candidateType === targetType;
  });

  const sameShape = eligible.filter((candidate) => {
    const candidateIsMultiword = normalizeText(candidate.word).includes(" ");
    return candidateIsMultiword === targetIsMultiword;
  });

  // Language guard: a distractor from a DIFFERENT language ("grab" among
  // Spanish options) makes the answer obvious by elimination. `getLanguagePool`
  // already narrows the pool, but it falls back to the full mixed pool when the
  // target item has no `language` (journey/standalone stories can carry a null
  // language), letting other-language favorites leak in. We resolve an
  // effective target language (the item's own, else the pool's dominant one)
  // and keep cross-language candidates as a LAST resort only, so we never drop
  // below the 4 options createFillBlankExercise needs.
  const targetLangKey =
    normalizeKey(item.language) ||
    (() => {
      const counts = new Map<string, number>();
      for (const candidate of pool) {
        const key = normalizeKey(candidate.language);
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      let best: { key: string; count: number } | null = null;
      for (const [key, count] of counts) {
        if (!best || count > best.count) best = { key, count };
      }
      return best?.key ?? "";
    })();
  // Same-language OR unknown-language candidates pass; only a candidate with a
  // KNOWN, different language is held back to the final fallback tier.
  const langOk = (candidate: PracticeFavoriteItem) => {
    if (!targetLangKey) return true;
    const key = normalizeKey(candidate.language);
    return !key || key === targetLangKey;
  };
  const byLang = (source: PracticeFavoriteItem[]) => source.filter(langOk);

  const picked: string[] = [];
  const seen = new Set<string>();
  const drainFrom = (source: PracticeFavoriteItem[]) => {
    for (const candidate of shuffle(source)) {
      if (picked.length >= max) break;
      const key = normalizeKey(candidate.word);
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(candidate.word);
    }
  };

  // Spanish gender/number agreement (soft, best-effort). A feminine-singular
  // target ("una ___ nerviosa") should prefer feminine-singular distractors so
  // the learner can't rule out masculine/plural options ("título", "botas") by
  // agreement instead of meaning. Falls back to the looser tiers below when the
  // pool can't fill 4 — so it never starves the exercise. CEFR-band filtering
  // is intentionally NOT here: items carry no level yet (that's phase 1).
  const targetAgr = normalizeKey(item.language) === "spanish" ? spanishAgreement(item.word) : null;
  const agreementMatch = (candidate: PracticeFavoriteItem): boolean => {
    if (!targetAgr) return false;
    const a = spanishAgreement(candidate.word);
    return !!a && a.gender === targetAgr.gender && a.plural === targetAgr.plural;
  };
  if (targetAgr) drainFrom(byLang(sameShapeAndType.filter(agreementMatch)));
  if (picked.length < max) drainFrom(byLang(sameShapeAndType));
  if (picked.length < max) drainFrom(byLang(sameShape));
  if (picked.length < max) drainFrom(byLang(eligible));
  // Last resort: allow other-language candidates only if same-language ones
  // couldn't fill the 4 options. Keeps short pools functional.
  if (picked.length < max) drainFrom(sameShapeAndType);
  if (picked.length < max) drainFrom(sameShape);
  if (picked.length < max) drainFrom(eligible);

  return picked;
}

function getDistractorMeanings(
  item: PracticeFavoriteItem,
  pool: PracticeFavoriteItem[],
  max = 3
): string[] {
  const seen = new Set<string>([normalizeKey(item.translation)]);
  const out: string[] = [];
  for (const candidate of shuffle(pool)) {
    const translation = normalizeText(candidate.translation);
    const key = normalizeKey(translation);
    if (!translation || seen.has(key)) continue;
    seen.add(key);
    out.push(translation);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Builds the blanked sentence AND captures the form actually present in
 * the sentence (the inflected one), so fill_blank can show the
 * conjugated form as the correct answer instead of the lemma. The lemma
 * stored in vocab (`preparare`) doesn't make sense as the gap-fill
 * answer when the original sentence had `preparava`.
 */
function getSentenceWithBlank(
  item: PracticeFavoriteItem
): { sentence: string; matchedForm: string } | null {
  // Siempre partir de `getContextSentence`: ya hace el split por
  // `.!?` y elige la oración que contiene la palabra objetivo. Si
  // antes usábamos `exampleSentence` crudo para items no-standalone,
  // un example multi-oración terminaba blankeando la palabra en (por
  // ej.) la segunda oración y después `shortenSentence` se quedaba
  // con la primera; el usuario veía la primera oración intacta sin
  // blank, con la respuesta correcta en un párrafo descartado.
  const sentence = getContextSentence(item);
  const word = normalizeText(item.word);
  if (!sentence || !word) return null;

  // Try literal match first.
  let pattern = new RegExp(escapeRegExp(word), "i");
  let isStemFallback = false;
  if (!pattern.test(sentence)) {
    // Stem fallback for inflected forms. The lemma stored in vocab is
    // often the dictionary form (`amare`), but the story body uses the
    // conjugated form (`amava`, `amo`, `ami`). Romance + Germanic
    // morphology lives in suffixes, so a prefix-stem match catches the
    // common cases without dragging in a real lemmatizer. Without this
    // the Fix-N button on end-of-story practice silently no-oped: every
    // verb item failed to produce a fill_blank exercise.
    const stemLen = Math.max(3, word.length - 2);
    const stem = word.slice(0, stemLen);
    // Trailing chars must include accented letters / combining marks, NOT
    // just ASCII `\w`. With `\w*` the match stopped at the first accented
    // char, so "levantó" matched only "levant" and the blank rendered as
    // "_____ó"; leaving the conjugation suffix visible gave the answer
    // away (only the past-tense option fit). `[\p{L}\p{M}\d]*` (u flag)
    // swallows the whole inflected surface form across all languages.
    pattern = new RegExp(`\\b${escapeRegExp(stem)}[\\p{L}\\p{M}\\d]*`, "iu");
    if (!pattern.test(sentence)) return null;
    isStemFallback = true;
  }
  // Capture the actual surface form in the sentence (e.g. "preparava")
  // so callers can use it as the answer instead of the lemma
  // ("preparare"). For the literal match the surface form IS the lemma.
  const matchResult = sentence.match(pattern);
  const matchedForm = isStemFallback && matchResult ? matchResult[0] : word;
  // Pasamos el anchor `_____` a shortenSentence para que cuando tenga
  // que recortar por puntuación/comas, conserve siempre el chunk con
  // el blank. Sin esto, una oración larga con varios commas dejaba al
  // usuario con la primera cláusula sin blank y opciones sin sentido.
  const shortened = shortenSentence(sentence.replace(pattern, "_____"), "_____");
  return { sentence: stripOrphanLeadingPunctuation(shortened), matchedForm };
}

/**
 * Envuelve la palabra objetivo dentro de una oración de ejemplo con
 * marcadores `[[…]]` para que la UI la resalte. Reusa el mismo matcher
 * literal→stem que `getSentenceWithBlank`, así el resaltado cae sobre la
 * misma forma flexionada que el modo context blankearía (consistencia).
 * Si la oración ya trae marcadores o no hay match, la devuelve intacta.
 */
export function markTargetWordInSentence(sentence: string, word: string): string {
  if (!sentence || sentence.includes("[[")) return sentence;
  const w = normalizeText(word);
  if (!w) return sentence;
  let pattern = new RegExp(escapeRegExp(w), "i");
  if (!pattern.test(sentence)) {
    const stemLen = Math.max(3, w.length - 2);
    const stem = w.slice(0, stemLen);
    pattern = new RegExp(`\\b${escapeRegExp(stem)}[\\p{L}\\p{M}\\d]*`, "iu");
    if (!pattern.test(sentence)) return sentence;
  }
  return sentence.replace(pattern, (match) => `[[${match}]]`);
}

// El splitter de `audioSegments` corta oraciones inmediatamente
// después de `.!?` (más comilla opcional), así que la "narrative
// tail" de un diálogo (`..."Algo", sagte X.`) sale como una oración
// que empieza con coma, comillas sueltas o dos puntos. Antes de
// mostrar al usuario, limpiamos esa basura del inicio. NO tocamos
// `¿` ni `¡` (puntuación inicial significativa en español).
function stripOrphanLeadingPunctuation(sentence: string): string {
  const cleaned = sentence
    .replace(/^[\s,;:"'“”«»\-–-]+/, "")
    .trim();
  if (!cleaned) return sentence;
  // Capitalizamos la primera letra si quedó en minúsculas; en
  // alemán las oraciones empiezan en mayúscula y, tras strippear el
  // diálogo, el verbo ("sagte", "rief") queda al inicio.
  const first = cleaned.charAt(0);
  const upper = first.toLocaleUpperCase();
  return first !== upper ? upper + cleaned.slice(1) : cleaned;
}

function getContextSentence(item: PracticeFavoriteItem): string {
  const sentence = normalizeText(item.exampleSentence);
  if (!sentence) return "";

  const sentences = splitStoryTextIntoSentences(sentence);
  if (sentences.length <= 1) return sentence;

  const word = normalizeText(item.word).toLowerCase();
  if (!word) return sentences[0] ?? sentence;

  return (
    sentences.find((candidate) => candidate.toLowerCase().includes(word)) ??
    sentences[0] ??
    sentence
  );
}

function shortenSentence(sentence: string, anchor?: string): string {
  const normalized = normalizeText(sentence);
  if (!normalized) return "";

  // En cada nivel de corte (oración, cláusula, ventana de palabras)
  // preferimos el chunk que contiene el anchor (típicamente `_____`
  // para fill_blank). Sin esto, el corte se queda siempre con la
  // primera parte y descarta la que tenía la palabra clave.
  const pickRelevant = (parts: string[], fallback: string): string => {
    if (anchor) {
      const withAnchor = parts.find((part) => part.includes(anchor));
      if (withAnchor) return withAnchor;
    }
    return parts[0] ?? fallback;
  };

  const splitOnStrongPunctuation = normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const firstSentence = pickRelevant(splitOnStrongPunctuation, normalized);

  // For a cloze (anchor present) we DON'T short-circuit on the full sentence:
  // the lead-in clauses (names, setting) add length without helping the gap
  // ("Sofía, una joven de la Ciudad de México, cuelga ... con una ___ nerviosa"
  // → keep only "cuelga ... con una ___ nerviosa"). Narrow to the clause that
  // holds the blank below. Non-cloze keeps the prior behaviour.
  if (!anchor && firstSentence.length <= 140) return firstSentence;

  const splitOnComma = firstSentence
    .split(/,\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const firstClause = pickRelevant(splitOnComma, firstSentence);

  if (firstClause.length <= 110) return firstClause;

  const words = firstClause.split(/\s+/).filter(Boolean);
  if (words.length <= 14) return firstClause;
  // Ventana de 14 palabras: si tenemos anchor, la centramos sobre la
  // posición del anchor para no perderlo aunque esté al final.
  if (anchor) {
    const idx = words.findIndex((part) => part.includes(anchor));
    if (idx >= 0) {
      const start = Math.max(0, idx - 6);
      const end = Math.min(words.length, start + 14);
      const slice = words.slice(start, end);
      const prefix = start > 0 ? "..." : "";
      const suffix = end < words.length ? "..." : "";
      return `${prefix}${slice.join(" ")}${suffix}`;
    }
  }
  return `${words.slice(0, 14).join(" ")}...`;
}

function buildAudioClip(item: PracticeFavoriteItem, sentence: string): PracticeAudioClip | null {
  const storySlug = normalizeText(item.storySlug);
  if (!storySlug) return null;
  return {
    storySlug,
    sentence,
    storySource: getStorySource(item.sourcePath, item.storySlug),
    language: item.language ?? null,
    targetWord: normalizeText(item.word) || null,
    segmentId: getSegmentIdFromSourcePath(item.sourcePath),
    voiceId: item.voiceId ?? null,
    // Clip pre-horneado (server-joined). Cuando existe, el mobile lo reproduce
    // directo (sin Modal) y siempre corresponde a `sentence`. Ver garantía en
    // el tipo PracticeFavoriteItem.clipUrl.
    clipUrl: item.clipUrl ?? null,
    cachedUrl: item.clipUrl ?? null,
    // Forward server-side pre-computed timings so the mobile player
    // can skip fuzzy segment matching. Null on items where the source
    // story has no aeneas alignment.
    audioWordStartSec: item.audioWordStartSec ?? null,
    audioWordEndSec: item.audioWordEndSec ?? null,
    audioSentenceStartSec: item.audioSentenceStartSec ?? null,
    audioSentenceEndSec: item.audioSentenceEndSec ?? null,
  };
}

// Make a distractor's first-letter case match the correct answer's, so a
// mid-sentence blank never reads "Parcial / Botas" beside "sonrisa" (a tell,
// and visually broken). Keying off the answer keeps it language-safe: German
// answers are capitalized nouns → distractors stay capitalized; Spanish answers
// are lowercase → distractors get lowercased.
function matchFirstCharCase(word: string, lower: boolean): string {
  if (!word) return word;
  const first = word.charAt(0);
  const adjusted = lower ? first.toLocaleLowerCase() : first.toLocaleUpperCase();
  return adjusted + word.slice(1);
}

function createFillBlankExercise(
  item: PracticeFavoriteItem,
  pool: PracticeFavoriteItem[]
): FillBlankExercise | null {
  const fullSentence = getContextSentence(item);
  const blanked = getSentenceWithBlank(item);
  if (!blanked || !fullSentence) return null;
  // Reject degenerate clozes: when the saved example was essentially
  // just the target word, blanking leaves "_____" (or "_____.") with no
  // surrounding context, so the Context card renders an empty prompt
  // (only the answer options show). Require at least two real word
  // tokens around the blank for a usable sentence-level cue; otherwise
  // the item falls back to meaning/listening in buildPracticeSession.
  const contextTokens = blanked.sentence
    .replace(/_{3,}/g, " ")
    .split(/\s+/)
    .filter((token) => /\p{L}/u.test(token));
  if (contextTokens.length < 2) return null;
  // Answer = the surface form actually present in the sentence
  // (`preparava` if the lemma is `preparare`). Showing the lemma as
  // the gap-fill answer didn't match the grammatical context the
  // learner was reading, so the option set felt nonsensical.
  const answerForm = blanked.matchedForm;
  const answerStartsLower = answerForm.charAt(0) === answerForm.charAt(0).toLocaleLowerCase();
  const distractors = getDistractorWords(item, getLanguagePool(item.language, pool)).map((d) =>
    matchFirstCharCase(d, answerStartsLower)
  );
  const options = shuffle([answerForm, ...distractors]);
  if (options.length < 4) return null;
  return {
    id: `fill_blank:${normalizeKey(item.word)}`,
    type: "fill_blank",
    prompt: "Complete the sentence with the right word or expression.",
    sentence: blanked.sentence,
    storySlug: item.storySlug ?? null,
    audioClip: buildAudioClip(item, fullSentence),
    options,
    answer: answerForm,
  };
}

function createMeaningContextExercise(
  item: PracticeFavoriteItem,
  pool: PracticeFavoriteItem[]
): MeaningContextExercise | null {
  const fullSentence = isStandaloneSourcePath(item.sourcePath, item.storySlug)
    ? getContextSentence(item)
    : normalizeText(item.exampleSentence);
  const sentence = stripOrphanLeadingPunctuation(shortenSentence(fullSentence));
  if (!sentence) return null;
  const options = shuffle([
    item.translation,
    ...getDistractorMeanings(item, getLanguagePool(item.language, pool)),
  ]);
  if (options.length < 4) return null;
  return {
    id: `meaning_in_context:${normalizeKey(item.word)}`,
    type: "meaning_in_context",
    prompt: "Choose the meaning that fits this word in context.",
    word: item.word,
    sentence,
    storySlug: item.storySlug ?? null,
    audioClip: buildAudioClip(item, isStandaloneSourcePath(item.sourcePath, item.storySlug) ? fullSentence : sentence),
    options,
    answer: item.translation,
  };
}

function createListenChooseExercise(
  item: PracticeFavoriteItem,
  pool: PracticeFavoriteItem[]
): ListenChooseExercise | null {
  const options = shuffle([item.word, ...getDistractorWords(item, getLanguagePool(item.language, pool))]);
  if (options.length < 4) return null;
  return {
    id: `listen_choose:${normalizeKey(item.word)}`,
    type: "listen_choose",
    prompt: "Listen and choose the word you hear.",
    speechText: item.word,
    language: item.language ?? null,
    options,
    answer: item.word,
  };
}

function createMatchMeaningExercise(items: PracticeFavoriteItem[]): MatchMeaningExercise | null {
  const candidates = uniqueByWord(items).filter(
    (item) => normalizeText(item.word) && normalizeText(item.translation)
  );
  if (candidates.length < 4) return null;
  const selected = shuffle(candidates).slice(0, 4);
  const meanings = shuffle(selected.map((item) => item.translation));
  const pairs = selected.map((item) => ({
    word: item.word,
    answer: item.translation,
    options: meanings,
    language: item.language ?? null,
    voiceId: item.voiceId ?? null,
  }));
  return {
    id: `match_meaning:${selected.map((item) => normalizeKey(item.word)).join("|")}`,
    type: "match_meaning",
    prompt: "Match the words to their meanings.",
    pairs,
  };
}

export function getDuePracticeItems(items: PracticeFavoriteItem[]): PracticeFavoriteItem[] {
  const now = Date.now();
  return items.filter((item) => {
    if (!item.nextReviewAt) return true;
    const nextReviewAt = Date.parse(item.nextReviewAt);
    return !Number.isFinite(nextReviewAt) || nextReviewAt <= now;
  });
}

// SRS-aware ordering: items whose nextReviewAt is in the past come first
// (lapsed/new), then scheduled-future ascending. Uses the same comparator the
// server side /api/practice/due endpoint applies, so client and server agree
// on dueness even when the client is hydrating from cache. Pure-additive
// helper; existing sort paths in getPracticeSource stay untouched to preserve
// their source-weight prioritisation. Use this when you want plain dueness
// ordering, e.g. on the entry to a practice session.
export function sortPracticeItemsByDueness(
  items: PracticeFavoriteItem[]
): PracticeFavoriteItem[] {
  const now = Date.now();
  const dueness = (item: PracticeFavoriteItem): number => {
    if (!item.nextReviewAt) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(item.nextReviewAt);
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  };
  return [...items].sort((a, b) => {
    const aDue = dueness(a);
    const bDue = dueness(b);
    if (aDue !== bDue) return aDue - bDue;
    return a.word.localeCompare(b.word);
  });
}

function getPracticeSource(
  items: PracticeFavoriteItem[],
  prefs?: OnboardingPracticePrefs
): PracticeFavoriteItem[] {
  const all = uniqueByWord(items);
  const due = uniqueByWord(getDuePracticeItems(all));
  if (due.length === 0) return all;
  const dueKeys = new Set(due.map((item) => `${normalizeKey(item.language)}::${normalizeKey(item.word)}`));
  const sourceWeight = (item: PracticeFavoriteItem) => {
    switch (item.practiceSource) {
      case "both":
        return 3;
      case "curriculum":
      case "user_saved":
        return 2;
      default:
        return 1;
    }
  };
  const sortByPriority = (pool: PracticeFavoriteItem[]) =>
    [...pool].sort((a, b) => {
      const weightDiff = sourceWeight(b) - sourceWeight(a);
      if (weightDiff !== 0) return weightDiff;
      const aReview = a.nextReviewAt ? Date.parse(a.nextReviewAt) : Number.NaN;
      const bReview = b.nextReviewAt ? Date.parse(b.nextReviewAt) : Number.NaN;
      if (Number.isFinite(aReview) && Number.isFinite(bReview) && aReview !== bReview) {
        return aReview - bReview;
      }
      return a.word.localeCompare(b.word);
    });

  const orderedDue = sortByPriority(due);
  const orderedRest = sortByPriority(
    all.filter((item) => !dueKeys.has(`${normalizeKey(item.language)}::${normalizeKey(item.word)}`))
  );
  const ordered = [...orderedDue, ...orderedRest];
  return prefs ? sortPracticeItemsByOnboarding(ordered, prefs, true) : ordered;
}

export function buildPracticeSession(
  items: PracticeFavoriteItem[],
  mode: PracticeMode,
  prefs?: OnboardingPracticePrefs
): PracticeExercise[] {
  const source = getPracticeSource(items, prefs);
  if (source.length === 0) return [];

  const languageAwarePool = uniqueByWord([...source, ...catalogPool]);
  const exercises: PracticeExercise[] = [];

  if (mode === "match") {
    let remaining = uniqueByWord(source);
    for (let i = 0; i < 3 && exercises.length < 10; i += 1) {
      const exercise = createMatchMeaningExercise(shuffle(remaining));
      if (exercise && !exercises.some((existing) => existing.id === exercise.id)) {
        exercises.push(exercise);
        const usedKeys = new Set(
          exercise.pairs.map(
            (pair) => `${normalizeKey(remaining.find((item) => item.word === pair.word)?.language)}::${normalizeKey(pair.word)}`
          )
        );
        remaining = remaining.filter(
          (item) => !usedKeys.has(`${normalizeKey(item.language)}::${normalizeKey(item.word)}`)
        );
      }
    }
    return exercises;
  }

  const builder =
    mode === "meaning"
      ? createMeaningContextExercise
      : mode === "context"
        ? createFillBlankExercise
        : createListenChooseExercise;

  // Para los modos basados en frase (context/meaning) también
  // deduplicamos por oración subyacente. Si el usuario guardó varias
  // palabras de la misma frase, cada item arma un ejercicio distinto pero
  // sobre la misma oración; solo cambiaba la palabra con el blank y el
  // bug reportado era ver "la misma oración varias veces y solo cambia
  // la palabra". El id del ejercicio se basa en la palabra, así que el
  // dedup por id no atrapaba esto.
  const sentenceAwareMode = mode === "context" || mode === "meaning";
  const seenSentences = new Set<string>();

  for (const item of source) {
    if (exercises.length >= 10) break;
    if (sentenceAwareMode) {
      const sentenceKey = normalizeKey(getContextSentence(item));
      if (sentenceKey && seenSentences.has(sentenceKey)) continue;
      const exercise = builder(item, languageAwarePool);
      if (!exercise) continue;
      if (exercises.some((existing) => existing.id === exercise.id)) continue;
      if (sentenceKey) seenSentences.add(sentenceKey);
      exercises.push(exercise);
      continue;
    }
    const exercise = builder(item, languageAwarePool);
    if (!exercise) continue;
    if (exercises.some((existing) => existing.id === exercise.id)) continue;
    exercises.push(exercise);
  }

  return exercises;
}

function getExerciseAnchor(exercise: PracticeExercise): string {
  switch (exercise.type) {
    case "meaning_in_context":
      return normalizeKey(exercise.word);
    case "fill_blank":
    case "listen_choose":
      return normalizeKey(exercise.answer);
    case "match_meaning":
      return normalizeKey(exercise.pairs.map((pair) => pair.word).join("|"));
  }
}

export function buildMixedPracticeSession(
  items: PracticeFavoriteItem[],
  plan: PracticeMode[],
  maxExercises = 10,
  prefs?: OnboardingPracticePrefs
): PracticeExercise[] {
  const sessionsByMode = new Map<PracticeMode, PracticeExercise[]>(
    plan.map((mode) => [mode, buildPracticeSession(items, mode, prefs)])
  );
  const nextIndexByMode = new Map<PracticeMode, number>(plan.map((mode) => [mode, 0]));
  const usedAnchors = new Set<string>();
  const exercises: PracticeExercise[] = [];

  for (const mode of plan) {
    if (exercises.length >= maxExercises) break;
    const session = sessionsByMode.get(mode) ?? [];
    let index = nextIndexByMode.get(mode) ?? 0;

    while (index < session.length) {
      const candidate = session[index];
      index += 1;
      const anchor = getExerciseAnchor(candidate);
      if (usedAnchors.has(anchor)) continue;
      usedAnchors.add(anchor);
      exercises.push(candidate);
      break;
    }

    nextIndexByMode.set(mode, index);
  }

  if (exercises.length >= maxExercises) return exercises.slice(0, maxExercises);

  for (const mode of [("meaning" as const), ("context" as const), ("listening" as const), ("match" as const)]) {
    if (exercises.length >= maxExercises) break;
    const session = sessionsByMode.get(mode) ?? [];
    let index = nextIndexByMode.get(mode) ?? 0;

    while (index < session.length && exercises.length < maxExercises) {
      const candidate = session[index];
      index += 1;
      const anchor = getExerciseAnchor(candidate);
      if (usedAnchors.has(anchor)) continue;
      usedAnchors.add(anchor);
      exercises.push(candidate);
    }

    nextIndexByMode.set(mode, index);
  }

  return exercises;
}

export function buildTopicCheckpointPracticeSession(items: PracticeFavoriteItem[]): PracticeExercise[] {
  return buildMixedPracticeSession(
    items,
    ["meaning", "context", "listening", "meaning", "context", "listening", "match", "meaning"],
    8
  );
}

export function getRecommendedPracticeModeFromOnboarding(
  items: PracticeFavoriteItem[],
  fallback: PracticeMode,
  prefs?: OnboardingPracticePrefs
): PracticeMode {
  if (!prefs) return fallback;
  const bias = getPracticeModeBias(prefs);
  if (!bias) return fallback;

  const sorted = sortPracticeItemsByOnboarding(items, prefs, true);
  if (sorted.length === 0) return fallback;

  if (bias === "context") {
    return sorted.some((item) => normalizeText(item.exampleSentence)) ? "context" : fallback;
  }
  if (bias === "listening") {
    return sorted.some((item) => item.storySlug || item.language) ? "listening" : fallback;
  }
  return bias;
}

export function getSpeechSynthesisLang(language?: string | null): string {
  switch (normalizeKey(language)) {
    case "spanish":
      return "es-ES";
    case "german":
      return "de-DE";
    case "french":
      return "fr-FR";
    case "italian":
      return "it-IT";
    case "portuguese":
      return "pt-BR";
    case "japanese":
      return "ja-JP";
    case "korean":
      return "ko-KR";
    case "chinese":
      return "zh-CN";
    default:
      return "en-US";
  }
}
