/**
 * PORTÓN DE ESCALERA: ningún journey nuevo puede dejar un peldaño hueco.
 *
 * WHY (2026-09-07, regla del usuario): el B1 de portugués se abrió por
 * demanda medida con el A2 sin existir, y la escalera quedó A0, A1, hueco,
 * B1. Quien mide A2 cae en un A1 que le queda corto o en un B1 que le queda
 * grande. La decisión de saltarse un peldaño no se volverá a tomar en
 * silencio: "es crucial que pongas una regla para que nunca se cree un
 * journey si hay uno faltando de por medio. Tienes que prohibirlo."
 *
 * La regla: dentro de un mismo (idioma, variante, tipo), después de crear el
 * journey nuevo el conjunto de niveles tiene que ser CONTIGUO en la escalera
 * A0..C2. Crear por debajo del mínimo o pegado al máximo pasa; crear dejando
 * hueco tira. Un hueco heredado (el A2 PT de este mismo día) también bloquea
 * crecer por encima: primero se rellena, luego se sube. Los archivados no
 * cuentan, como en toda la clasificación.
 *
 * Se llama ANTES de journey.create; el hook
 * `.claude/safety/pre-journey-guard.sh` bloquea cualquier ejecución que
 * escriba un journey sin nombrarla, igual que el portón de temas.
 */

export const ESCALERA = ["a0", "a1", "a2", "b1", "b2", "c1", "c2"] as const;

/**
 * Journeys que NO cuentan para la contigüidad. Cada entrada lleva su porqué y
 * su fecha; la lista no crece sin una decisión del usuario.
 *
 * - cmroo4w4v0000324ow1o9qlcp (Friends DE C1): test del usuario, 2026-09-13;
 *   la escalera del Friends DE empieza en el A0. Literal: "en realidad C1 fue
 *   un test para mí, pero ahora sí vamos a crear el journey bien". Sigue live
 *   en la base; solo deja de sostener la escalera.
 * - cmrdqk484000032r4rt2vw4ej (Friends ES C1, hoy variant="latam"): temporal,
 *   2026-09-19, pendiente de pasar a "latam-multi" en el flip de
 *   TAXONOMIA_variantes_latam (Journey.variant en BD, DESPUES del deploy web
 *   y de la build movil). Mientras su variant siga siendo literalmente
 *   "latam", cuenta como el mismo (idioma, variante, nombre) que un futuro
 *   "Friends" A1 latam NEUTRAL y bloquearia su creacion por hueco (B1/B2
 *   faltantes). Quitar esta entrada en el flip: a partir de ahi su variant
 *   real ("latam-multi") ya lo separa solo, sin necesitar la excepcion.
 */
export const FUERA_DE_ESCALERA: ReadonlySet<string> = new Set([
  "cmroo4w4v0000324ow1o9qlcp",
  "cmrdqk484000032r4rt2vw4ej",
]);

export type JourneyExistente = {
  /** Sin id no se puede excluir: un journey sin id cuenta siempre. */
  id?: string;
  name: string;
  language: string;
  variant: string;
  levels: string[];
  status: string;
};

export function assertLadderContiguous(
  nuevo: { name: string; language: string; variant: string; levels: string[] },
  existentes: JourneyExistente[],
): void {
  const idx = (l: string) => ESCALERA.indexOf(l.toLowerCase() as (typeof ESCALERA)[number]);
  const propios = existentes.filter(
    (j) =>
      j.status !== "archived" &&
      !(j.id && FUERA_DE_ESCALERA.has(j.id)) &&
      j.language.toLowerCase() === nuevo.language.toLowerCase() &&
      j.variant.toLowerCase() === nuevo.variant.toLowerCase() &&
      j.name.toLowerCase() === nuevo.name.toLowerCase(),
  );
  const niveles = new Set<number>();
  for (const j of propios) for (const l of j.levels) if (idx(l) >= 0) niveles.add(idx(l));
  for (const l of nuevo.levels) {
    const i = idx(l);
    if (i < 0)
      throw new Error(`journey-ladder: nivel desconocido "${l}" (escalera: ${ESCALERA.join(", ")})`);
    niveles.add(i);
  }
  if (niveles.size === 0) return;
  const min = Math.min(...niveles);
  const max = Math.max(...niveles);
  const huecos: string[] = [];
  for (let i = min; i <= max; i++) if (!niveles.has(i)) huecos.push(ESCALERA[i].toUpperCase());
  if (huecos.length)
    throw new Error(
      `journey-ladder: crear ${nuevo.name} ${nuevo.language}/${nuevo.variant} ` +
        `${nuevo.levels.join("/")} dejaria la escalera con hueco en ${huecos.join(", ")} ` +
        `(niveles live+draft del tipo: ${[...niveles].sort((a, b) => a - b).map((i) => ESCALERA[i]).join(", ")}). ` +
        `Primero se rellena el peldano que falta; un catalogo no salta escalones.`,
    );
}
