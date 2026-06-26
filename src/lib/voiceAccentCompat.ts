/**
 * Capa 2 del sistema de reglas voz-región: compatibility table que
 * decide, para una historia ambientada en X y una voz con accentTags
 * Y, si el match es perfecto, aceptable, o un mismatch que merece un
 * confirm modal antes de aceptarlo.
 *
 * Filosofía:
 *  - "perfect" = el accent del speaker matchea el setting (ej: voz
 *    mexicana en historia mexicana). Es el match preferido.
 *  - "acceptable" = no es perfecto pero pasa sin chocar al oído (ej:
 *    voz latam-neutra en historia mexicana, o voz colombiana en
 *    historia mexicana). El sistema sugiere `perfect` primero pero no
 *    bloquea.
 *  - "block" = mismatch grosero (ej: voz argentina en historia
 *    mexicana, o voz peninsular en historia LATAM). El UI sigue
 *    permitiéndolo pero con confirm modal explícito; se reserva para
 *    casos legítimos como un personaje extranjero ("turista español
 *    en CDMX") donde el mismatch es intencional.
 *  - "unknown" = no tenemos suficiente info (voz sin tags o setting
 *    fuera de la tabla). El UI lo trata como acceptable pero lo
 *    marca para auditoría.
 *
 * Importante: una voz `unverified` siempre cae en "unknown"; sin oído
 * humano que confirme el accent, no podemos rankear su compatibilidad.
 */

import type { AccentTag } from "./voiceCatalog";

export type StorySetting =
  // Spanish-speaking
  | "mexico"
  | "argentina"
  | "colombia"
  | "chile"
  | "peru"
  | "caribbean"
  | "spain"
  | "spain-andalusia"
  | "spain-north"
  | "latam-generic" // setting LATAM sin país específico
  // Portuguese-speaking
  | "brazil-paulista"
  | "brazil-carioca"
  | "brazil-ne"
  | "portugal"
  // Italian
  | "italy-rome"
  | "italy-milan"
  | "italy-naples"
  | "italy-florence"
  | "italy-generic"
  // German
  | "germany"
  | "austria"
  // English
  | "us-generic"
  | "uk-generic"
  | "australia";

export type CompatScore = "perfect" | "acceptable" | "block" | "unknown";

export type CompatResult = {
  score: CompatScore;
  reason: string;
};

type CompatRule = {
  perfect: AccentTag[];
  acceptable: AccentTag[];
  /** Tags que disparan confirm modal. Lo demás (no listado en
   *  perfect/acceptable/block) cae en "unknown". */
  block: AccentTag[];
};

/**
 * Tabla de compatibilidad. Editar aquí para refinar reglas. Cada
 * entrada lista los acentos preferidos, los aceptables y los que
 * deberían bloquear con confirm.
 */
const COMPAT_TABLE: Record<StorySetting, CompatRule> = {
  // Spanish settings
  mexico: {
    perfect: ["mexican"],
    acceptable: ["neutral-latam", "colombian"],
    block: ["argentine", "peninsular-castilian", "peninsular-andalusian", "peninsular-northern", "caribbean"],
  },
  argentina: {
    perfect: ["argentine"],
    acceptable: ["neutral-latam"],
    block: ["mexican", "colombian", "caribbean", "peninsular-castilian", "peninsular-andalusian", "peninsular-northern"],
  },
  colombia: {
    perfect: ["colombian"],
    acceptable: ["neutral-latam"],
    block: ["argentine", "mexican", "peninsular-castilian", "peninsular-andalusian", "peninsular-northern"],
  },
  chile: {
    perfect: ["chilean"],
    acceptable: ["neutral-latam"],
    block: ["argentine", "mexican", "colombian", "peninsular-castilian", "peninsular-andalusian", "peninsular-northern"],
  },
  peru: {
    perfect: ["peruvian"],
    acceptable: ["neutral-latam", "colombian"],
    block: ["argentine", "peninsular-castilian", "peninsular-andalusian"],
  },
  caribbean: {
    perfect: ["caribbean"],
    acceptable: ["neutral-latam"],
    block: ["argentine", "peninsular-castilian", "peninsular-andalusian", "peninsular-northern"],
  },
  spain: {
    // Madrid / Castilla; el "Spanish from Spain" default.
    perfect: ["peninsular-castilian"],
    acceptable: ["peninsular-northern", "peninsular-andalusian"],
    block: ["mexican", "argentine", "colombian", "chilean", "peruvian", "caribbean", "neutral-latam"],
  },
  "spain-andalusia": {
    perfect: ["peninsular-andalusian"],
    acceptable: ["peninsular-castilian"],
    block: ["mexican", "argentine", "colombian", "neutral-latam"],
  },
  "spain-north": {
    perfect: ["peninsular-northern"],
    acceptable: ["peninsular-castilian"],
    block: ["mexican", "argentine", "neutral-latam"],
  },
  "latam-generic": {
    // Cuando el setting es LATAM pero la historia no especifica país.
    // Aceptamos cualquier acento LATAM; bloqueamos solo peninsulares.
    perfect: ["neutral-latam"],
    acceptable: ["mexican", "argentine", "colombian", "chilean", "peruvian", "caribbean"],
    block: ["peninsular-castilian", "peninsular-andalusian", "peninsular-northern"],
  },

  // Portuguese settings
  "brazil-paulista": {
    perfect: ["brazilian-paulista"],
    acceptable: ["brazilian-carioca", "brazilian-ne"],
    block: ["portuguese-lisbon", "portuguese-porto"],
  },
  "brazil-carioca": {
    perfect: ["brazilian-carioca"],
    acceptable: ["brazilian-paulista", "brazilian-ne"],
    block: ["portuguese-lisbon", "portuguese-porto"],
  },
  "brazil-ne": {
    perfect: ["brazilian-ne"],
    acceptable: ["brazilian-paulista", "brazilian-carioca"],
    block: ["portuguese-lisbon", "portuguese-porto"],
  },
  portugal: {
    perfect: ["portuguese-lisbon", "portuguese-porto"],
    acceptable: [],
    block: ["brazilian-paulista", "brazilian-carioca", "brazilian-ne"],
  },

  // Italian settings
  "italy-rome": {
    perfect: ["italian-roman"],
    acceptable: ["italian-neutral", "italian-florentine"],
    block: ["italian-neapolitan", "italian-milanese"],
  },
  "italy-milan": {
    perfect: ["italian-milanese"],
    acceptable: ["italian-neutral"],
    block: ["italian-neapolitan", "italian-roman"],
  },
  "italy-naples": {
    perfect: ["italian-neapolitan"],
    acceptable: ["italian-neutral"],
    block: ["italian-milanese", "italian-florentine"],
  },
  "italy-florence": {
    perfect: ["italian-florentine"],
    acceptable: ["italian-neutral", "italian-roman"],
    block: ["italian-neapolitan", "italian-milanese"],
  },
  "italy-generic": {
    perfect: ["italian-neutral"],
    acceptable: ["italian-roman", "italian-milanese", "italian-florentine", "italian-bolognese", "italian-neapolitan"],
    block: [],
  },

  // German settings
  germany: {
    perfect: ["german-hochdeutsch"],
    acceptable: [],
    block: ["german-austrian", "german-swiss"],
  },
  austria: {
    perfect: ["german-austrian"],
    acceptable: ["german-hochdeutsch"],
    block: ["german-swiss"],
  },

  // English settings
  "us-generic": {
    perfect: ["english-gen-am"],
    acceptable: ["english-southern-us"],
    block: ["english-rp", "english-australian"],
  },
  "uk-generic": {
    perfect: ["english-rp"],
    acceptable: [],
    block: ["english-gen-am", "english-australian", "english-southern-us"],
  },
  australia: {
    perfect: ["english-australian"],
    acceptable: [],
    block: ["english-gen-am", "english-rp"],
  },
};

/**
 * Score de compatibilidad para un voice tagueado X cuando se castea
 * en una historia con setting Y. La voz puede tener varios tags; nos
 * quedamos con el mejor match (un tag `perfect` gana sobre uno
 * `block` aunque la voz tenga ambos; caso edge de bilingüe).
 */
export function compatScore(
  voiceTags: AccentTag[] | undefined,
  storySetting: StorySetting | null
): CompatResult {
  if (!storySetting) {
    return { score: "unknown", reason: "Setting de la historia no determinado" };
  }
  if (!voiceTags || voiceTags.length === 0) {
    return { score: "unknown", reason: "Voz sin accentTags; auditar antes de castear" };
  }
  if (voiceTags.includes("unverified")) {
    return { score: "unknown", reason: "Voz `unverified`; auditar accent antes de usar" };
  }

  const rule = COMPAT_TABLE[storySetting];
  if (!rule) {
    return { score: "unknown", reason: `Setting "${storySetting}" no en tabla` };
  }

  // Mejor match gana.
  if (voiceTags.some((t) => rule.perfect.includes(t))) {
    return { score: "perfect", reason: "Acento matchea el setting de la historia" };
  }
  if (voiceTags.some((t) => rule.acceptable.includes(t))) {
    return { score: "acceptable", reason: "Acento aceptable para el setting" };
  }
  if (voiceTags.some((t) => rule.block.includes(t))) {
    return {
      score: "block",
      reason: `Acento ${voiceTags.join("/")} no encaja con setting ${storySetting}`,
    };
  }
  return { score: "unknown", reason: "Sin overlap con la tabla" };
}

/** Etiqueta corta + emoji para mostrar en el dropdown del casting. */
export function compatBadge(score: CompatScore): { emoji: string; text: string } {
  switch (score) {
    case "perfect":
      return { emoji: "🟢", text: "match perfecto" };
    case "acceptable":
      return { emoji: "🟡", text: "aceptable" };
    case "block":
      return { emoji: "🔴", text: "no recomendado" };
    case "unknown":
    default:
      return { emoji: "⚪", text: "sin auditar" };
  }
}
