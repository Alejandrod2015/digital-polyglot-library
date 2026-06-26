/** Detects dialogue speakers from a Spanish/German prose text.
 *
 * Strategy:
 *   1. Strip HTML, collapse whitespace.
 *   2. Find quoted spans (straight quotes "..." and curly “..."”).
 *      Em-dash dialogue (-…-) is also supported as paragraph-style turns.
 *   3. For each quoted span, look at a 80-char window before/after for an
 *      attribution pattern: VERB + capitalized name, or capitalized name + VERB.
 *   4. If no attribution, mark speaker as "?" so the UI can ask the user.
 *   5. Text outside quotes becomes "narrador" segments.
 */

export type DetectedSegment = { speaker: string; text: string };
export type DetectionResult = {
  segments: DetectedSegment[];
  speakers: string[]; // distinct, including "narrador" and possibly "?"
};

const ATTRIBUTION_VERBS_ES = [
  "dijo", "dice", "decía", "diciendo",
  "respondió", "responde", "respondía",
  "preguntó", "pregunta", "preguntaba",
  "exclamó", "exclama",
  "gritó", "grita",
  "añadió", "añade",
  "contestó", "contesta",
  "replicó", "replica",
  "murmuró", "murmura",
  "susurró", "susurra",
  "continuó", "continúa",
  "comentó", "comenta",
  "aseguró", "asegura",
  "afirmó", "afirma",
  "explicó", "explica",
  "pidió", "pide",
  "saludó", "saluda",
  "anunció", "anuncia",
  "suspiró", "suspira",
];

const ATTRIBUTION_VERBS_DE = [
  "sagte", "sagt",
  "fragte", "fragt",
  "antwortete", "antwortet",
  "rief", "ruft",
  "flüsterte", "flüstert",
  "erwiderte", "erwidert",
  "meinte", "meint",
  "fügte", "fügt", "hinzu",
  "lachte", "lacht",
  "begrüßte", "begrüßt",
];

const NAME = "([A-ZÁÉÍÓÚÑÄÖÜ][a-záéíóúñäöüß]{1,30})";

function buildAttributionRegexes(language: string): { after: RegExp; before: RegExp } {
  const lang = language.toLowerCase();
  const verbs = lang === "german" ? ATTRIBUTION_VERBS_DE : ATTRIBUTION_VERBS_ES;
  const verbAlt = verbs.join("|");
  return {
    // "Hola," dijo Sofía / "Bonjour", dit Sophie
    after: new RegExp(`^[\\s,.;:]*(?:${verbAlt})\\s+(?:la|el|le|der|die|das)?\\s*${NAME}`, "i"),
    // Sofía dijo: "Hola"
    before: new RegExp(`${NAME}\\s+(?:${verbAlt})\\s*[:,]?\\s*$`, "i"),
  };
}

function stripAndNormalize(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type Quote = { start: number; end: number; content: string };

function findStraightQuotes(text: string): Quote[] {
  const out: Quote[] = [];
  const re = /"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, content: m[1] });
  }
  return out;
}

function findCurlyQuotes(text: string): Quote[] {
  const out: Quote[] = [];
  // Pair matching: opening then matching closing
  const re = /[“«]([^”»]+)[”»]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, content: m[1] });
  }
  return out;
}

function findEmDashTurns(text: string): Quote[] {
  // Em-dash dialogue style: "- ¿Cómo estás?; preguntó Carmen."
  // We treat each em-dash-prefixed segment as a quoted span up to the next em-dash, period, or paragraph end.
  const out: Quote[] = [];
  const re = /-\s*([^-\n]+?)(?=\s*-|\s*$|\s*[.?!]\s+(?=[A-ZÁÉÍÓÚÑ]))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const c = m[1].trim();
    if (c.length > 0) {
      out.push({ start: m.index, end: m.index + m[0].length, content: c });
    }
  }
  return out;
}

export function detectDialogue(rawText: string, language: string): DetectionResult {
  const clean = stripAndNormalize(rawText);
  if (!clean) return { segments: [], speakers: [] };

  // Try straight quotes first; if none, try curly; em-dash style is rarer but supported.
  let quotes = findStraightQuotes(clean);
  if (quotes.length === 0) quotes = findCurlyQuotes(clean);
  if (quotes.length === 0) quotes = findEmDashTurns(clean);

  if (quotes.length === 0) {
    return { segments: [{ speaker: "narrador", text: clean }], speakers: ["narrador"] };
  }

  // Sort by start
  quotes.sort((a, b) => a.start - b.start);

  const { after, before } = buildAttributionRegexes(language);
  const segments: DetectedSegment[] = [];
  const speakerSet = new Set<string>();
  speakerSet.add("narrador");

  let cursor = 0;
  let lastKnownSpeaker = "?";
  for (const q of quotes) {
    if (q.start > cursor) {
      const between = clean.substring(cursor, q.start).trim();
      if (between) segments.push({ speaker: "narrador", text: between });
    }

    const beforeWindow = clean.substring(Math.max(0, q.start - 80), q.start);
    const afterWindow = clean.substring(q.end, Math.min(clean.length, q.end + 80));

    let speaker: string | null = null;
    const am = afterWindow.match(after);
    if (am) {
      speaker = am[1];
    } else {
      const bm = beforeWindow.match(before);
      if (bm) speaker = bm[1];
    }

    if (!speaker) {
      // Continuation: alternate to "the other" speaker if we know one, else "?"
      speaker = lastKnownSpeaker !== "?" ? "?" : "?";
    } else {
      lastKnownSpeaker = speaker;
    }

    speakerSet.add(speaker);
    segments.push({ speaker, text: q.content });
    cursor = q.end;
  }

  if (cursor < clean.length) {
    const tail = clean.substring(cursor).trim();
    if (tail) segments.push({ speaker: "narrador", text: tail });
  }

  return {
    segments,
    speakers: Array.from(speakerSet),
  };
}

/** Builds a multi-voice spec (for the Python --spec input) from detected
 * segments + a mapping of speaker → voiceId. Skips segments whose speaker
 * is not in the mapping (caller should validate and surface an error).
 */
export function buildSpecFromDetection(
  segments: DetectedSegment[],
  voiceBySpeaker: Record<string, string>
): Array<{ voice: string; text: string }> {
  const out: Array<{ voice: string; text: string }> = [];
  for (const seg of segments) {
    const voice = voiceBySpeaker[seg.speaker];
    if (!voice) continue;
    out.push({ voice, text: seg.text });
  }
  return out;
}
