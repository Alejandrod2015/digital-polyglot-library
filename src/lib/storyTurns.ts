/**
 * Turnos de dialogo ("Hablante: linea", el formato multivoz) y la decision
 * narrada / dialogada. UN SOLO SITIO decide las dos cosas.
 *
 * POR QUE (2026-09-11). El validador canonico lo decidia con tres regex
 * distintas, y dos de ellas tomaban por turno cualquier arranque en mayuscula
 * seguido de dos puntos:
 *
 *   - "La cantina se llenó:" (19 caracteres) volvia DIALOGADA una historia
 *     narrada, que se saltaba en silencio ancla sensorial, habla citada y
 *     hablante presentado (Traveler ES latam B2, de-pura-muina).
 *   - "Claudia se lo comentó a Marcos:" contaba como turno para
 *     body-consecutive-narrators y para el alcance de la apertura (Traveler ES
 *     spain B2).
 *
 * Medido ese dia sobre las 633 historias live y draft: 78 arranques narrados
 * ("Camilo piensa:", "Jorge dice:", "Renata quiso arrancarle la libreta y no
 * lo hizo:") pasaban por turno, y ninguna etiqueta real de las 70 historias
 * multivoz lleva una palabra en minuscula.
 */

export type StoryStyle = "multivoice" | "narrator";

// Etiqueta de hablante: de una a cuatro palabras y TODAS con mayuscula inicial
// ("Nora", "Frau Siebert", "Doña Rosa", "Verkäuferin"). Un arranque de prosa
// lleva siempre un verbo o un articulo en minuscula, y con eso basta para
// separarlo; un tope de caracteres no separa nada ("La cantina se llenó" cabe).
const TURN_RE =
  /^([\p{Lu}][\p{L}\p{M}.'\-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'\-]*){0,3}):\s+(\S.*)$/u;

/** Forma multivoz completa: la que exigen speakers-count y speaker-lines. */
export const MIN_TURNS = 4;
export const MIN_SPEAKERS = 2;

export type SpeakerTurn = { speaker: string; speech: string };

/** Una LINEA como turno de dialogo, o null si es prosa. */
export function parseSpeakerTurn(line: string): SpeakerTurn | null {
  const m = line.trim().match(TURN_RE);
  return m ? { speaker: m[1].trim(), speech: m[2].trim() } : null;
}

export function isSpeakerTurn(line: string): boolean {
  return parseSpeakerTurn(line) !== null;
}

/** Un PARRAFO es turno si su primera linea lo es. */
export function paragraphIsTurn(paragraph: string): boolean {
  return isSpeakerTurn(paragraph.trim().split("\n")[0] ?? "");
}

export function speakerTurns(text: string): SpeakerTurn[] {
  const out: SpeakerTurn[] = [];
  for (const line of text.split("\n")) {
    const t = parseSpeakerTurn(line);
    if (t) out.push(t);
  }
  return out;
}

export function extractSpeakerNames(text: string): string[] {
  return [...new Set(speakerTurns(text).map((t) => t.speaker))];
}

export function countSpeakerLines(text: string): number {
  return speakerTurns(text).length;
}

export type StoryFormat = {
  turns: number;
  speakers: string[];
  /**
   * Narrada: cero turnos y, o bien el estilo declarado es "narrator", o bien
   * (sin declarar) lleva la comilla curva del catalogo. Exime los tres checks
   * de multivoz (body-dialogue-ratio, speakers-count, speaker-lines).
   */
  narrada: boolean;
  /**
   * Dialogada: forma multivoz COMPLETA (4 turnos, 2 hablantes) y un estilo
   * declarado que no sea "narrator". Solo esta exime los checks de narrada.
   *
   * Lo que no es ni una cosa ni la otra (un turno suelto en prosa, una
   * multivoz a medias) no se exime de NADA: corre los dos juegos de checks.
   * Un falso positivo ya no puede apagar un check; como mucho enciende uno.
   */
  dialogada: boolean;
};

export function classifyStoryFormat(text: string, declared?: StoryStyle): StoryFormat {
  const turns = speakerTurns(text);
  const speakers = [...new Set(turns.map((t) => t.speaker))];
  const narrada =
    turns.length === 0 &&
    (declared === "narrator" || (declared === undefined && text.includes("“")));
  const dialogada =
    declared !== "narrator" && turns.length >= MIN_TURNS && speakers.length >= MIN_SPEAKERS;
  return { turns: turns.length, speakers, narrada, dialogada };
}
