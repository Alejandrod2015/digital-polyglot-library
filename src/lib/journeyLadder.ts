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

export type JourneyExistente = {
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
