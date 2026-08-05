/**
 * ¿Merece esta palabra una plaza de VOCABULARIO CURADO?
 *
 * ── El criterio ──────────────────────────────────────────────────────────
 *
 * La app tiene dos capas distintas y hasta ahora solo una estaba escrita:
 *
 *   quick lookup  →  "si no la entiendes, tócala". Cubre CUALQUIER palabra
 *                    con glosa. Es comprensión, y es gratis para el usuario.
 *   vocab curado  →  "esto llévatelo puesto". Es una promesa de que vale la
 *                    pena memorizarlo: genera pills, ejercicios y repaso.
 *
 * Una palabra gana plaza en el vocabulario curado cuando el usuario la va a
 * NECESITAR otra vez: porque se repite, porque le permite decir algo, o
 * porque define un sitio, una comida o una forma de hablar y por tanto es
 * parte de lo que el journey vende.
 *
 * NO la gana cuando basta con entenderla en el sitio donde aparece. Etiquetas
 * administrativas, nombres de documentos, tecnicismos de trámite: el lector
 * necesita saber QUÉ es mientras lee, no cargarla en la memoria. Para eso ya
 * está el lookup, que la cubre para todo el mundo.
 *
 * OJO, y es el error fácil: esto NO es una cuestión de nivel ni de rareza.
 * `guelaguetza`, `híjole`, `weon` o `tejate` aparecen una sola vez en todo el
 * corpus, igual que `Zählerstand`, y sin embargo se quedan: son exactamente
 * el color que hace que el journey sepa a Oaxaca o a Santiago. Un usuario de
 * C1 leyendo una historia de C1 tampoco necesita memorizar cómo se llama un
 * carnet de servicio. Rareza y nivel no deciden; la utilidad sí.
 *
 * ── Cómo se mide, sin gastar en LLM ──────────────────────────────────────
 *
 * Misma filosofía que el juez CEFR (`src/lib/cefr/spanishLevelJudge.ts`):
 * listas, cero llamadas a modelos, y ante la duda NO se marca.
 *
 * La señal vive en la DEFINICIÓN, que siempre se escribe en inglés, así que
 * la misma regla vale para alemán, español, italiano o lo que venga. Una
 * etiqueta inerte se define por su función burocrática ("official document
 * issued by...", "form for...", "reading of the meter"). Un ancla cultural se
 * define nombrando cultura, lugar, comida o registro.
 *
 * Precisión sobre cobertura, a propósito: esto alimenta un gate que BLOQUEA,
 * así que un falso positivo le cuesta tiempo real a quien escribe. Solo se
 * marca lo que encaja en el patrón inerte Y no tiene ninguna señal
 * protectora. Todo lo demás pasa.
 */

export type VocabUtilityVerdict = "carry" | "lookup_only";

export type VocabUtilityEntry = {
  word: string;
  definition?: string | null;
  type?: string | null;
  register?: string | null;
};

export type VocabUtilityResult = {
  verdict: VocabUtilityVerdict;
  /** Señal concreta que disparó el veredicto, para poder explicarlo. */
  reason: string | null;
};

/**
 * Definiciones de cosa administrativa: documentos, trámites, cargos y
 * lecturas. Todas describen un objeto de procedimiento, no algo que el
 * hablante vaya a querer decir.
 */
const INERT_DEFINITION = [
  // Sin `form` suelto a propósito: "a no delivered in official form" describe
  // el MODO, no un documento, y degradaba `die Absage`, que es palabra útil.
  // Los formularios de verdad los cogen "application/registration form".
  // "official <cosa>" A SECAS describe una CLASE, y la palabra de la clase es
  // justo la productiva: `die Bescheinigung` ("official certificate confirming
  // a fact") y `das Schreiben` ("official letter") son alemán corriente que un
  // expat dice cada semana. Lo inerte es el documento CONCRETO, y para eso ya
  // están los patrones de abajo ("certificate of good conduct", "proof of
  // salary", "handover report", "ID badge"): las 7 que quitamos el 2026-08-05
  // las siguen cogiendo todas. Calibrado contra el juicio del usuario, que
  // dejó Bescheinigung dentro a proposito.
  /\bofficial (document|paper|certificate|letter|record) (of|for|from)\b/i,
  /\bofficial (permit|licence|license)\b/i,
  /\b(id|identity|staff|service|press|student) (card|pass|badge)\b/i,
  // Mismo motivo: `certificate` / `attestation` a secas SON la traducción de
  // `die Bescheinigung`. El documento con nombre propio lo coge el patrón
  // `certificate of (good conduct|registration|…)` de más abajo.
  /\b(confirmation slip|registration form|application form)\b/i,
  /\bproof of (address|income|salary|payment|residence|employment|identity)\b/i,
  /\b(issued|stamped|signed|filed|submitted) by the (office|authority|landlord|employer|agency)\b/i,
  /\b(id|identity) card (for|issued|that)\b/i,
  /\b(meter|counter) reading\b/i,
  /\b(handover|inspection|transfer) (protocol|report|record)\b/i,
  /\b(membership|registration|application|processing|admission) (fee|form|request|slip)\b/i,
  /\bcertificate of (good conduct|registration|enrolment|enrollment)\b/i,
  /\bcase (worker|officer) (at|in|who)\b/i,
  /\b(residence|work|entry) (permit|title)\b/i,
];

/**
 * Señales que PROTEGEN la plaza aunque la definición suene funcional: color
 * cultural, registro hablado, comida, saludo, o cualquier cosa que ancle la
 * palabra a un sitio o a una forma de hablar.
 */
const PROTECTED_DEFINITION = [
  /\b(slang|colloquial|informal|affectionate|endearment|interjection|filler)\b/i,
  /\b(typical|traditional|regional|local|classic)\b/i,
  /\b(dish|food|drink|snack|meal|pastry|bread|coffee|beer|wine|soup|stew)\b/i,
  /\b(greeting|farewell|toast|blessing|exclamation|catchphrase)\b/i,
  /\b(festival|celebration|holiday|custom|tradition|ritual|dance|music)\b/i,
  /\b(in|from|around|across) (mexico|spain|argentina|colombia|chile|peru|oaxaca|berlin|hamburg|italy|germany|latin america)\b/i,
  /\b(used|said|heard) (a lot|constantly|all the time|everywhere)\b/i,
];

/** Tipos que nunca se degradan: no son etiquetas, son formas de decir. */
const PROTECTED_TYPES = new Set(["expression", "verb", "adverb", "adjective", "pronoun", "conjunction", "preposition"]);

/** Registros que delatan lengua hablada, y por tanto algo que sí se usa. */
const PROTECTED_REGISTERS = /\b(coloquial|colloquial|informal|slang|jerga|familiar|vulgar|carino|cariñoso)\b/i;

/**
 * Clasifica UNA entrada de vocabulario. Ante cualquier duda devuelve "carry":
 * el coste de degradar algo que enseñaba bien es mucho mayor que el de dejar
 * pasar una etiqueta.
 */
export function classifyVocabUtility(entry: VocabUtilityEntry): VocabUtilityResult {
  const definition = (entry.definition ?? "").trim();
  if (!definition) return { verdict: "carry", reason: null };

  const type = (entry.type ?? "").trim().toLowerCase();
  if (PROTECTED_TYPES.has(type)) return { verdict: "carry", reason: null };

  const register = (entry.register ?? "").trim();
  if (register && PROTECTED_REGISTERS.test(register)) return { verdict: "carry", reason: null };

  for (const protector of PROTECTED_DEFINITION) {
    if (protector.test(definition)) return { verdict: "carry", reason: null };
  }

  for (const pattern of INERT_DEFINITION) {
    const hit = definition.match(pattern);
    if (hit) {
      return {
        verdict: "lookup_only",
        reason: `la definición la describe como objeto de trámite ("${hit[0]}")`,
      };
    }
  }

  return { verdict: "carry", reason: null };
}

/** Entradas de una historia que no ganan su plaza. Vacío = todo bien. */
export function findLookupOnlyVocab(
  vocab: VocabUtilityEntry[]
): Array<{ word: string; reason: string }> {
  const out: Array<{ word: string; reason: string }> = [];
  for (const entry of vocab) {
    const result = classifyVocabUtility(entry);
    if (result.verdict === "lookup_only" && result.reason) {
      out.push({ word: entry.word, reason: result.reason });
    }
  }
  return out;
}
