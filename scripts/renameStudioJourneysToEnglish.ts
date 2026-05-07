/**
 * Renombra los Studio Journey rows + JourneyType rows que tienen
 * `name`/`label` en español a su equivalente en inglés, para que el
 * card del journey en la app (que copia ese name al crear un journey)
 * sea consistente con el resto del UI.
 *
 * Toca DOS tablas:
 *   - dp_journeys_v1       (`Journey.name`)         — instancia por idioma/variant
 *   - dp_journey_types_v1  (`JourneyType.label`)    — los 8 tipos canónicos
 *
 * Mapping derivado de los 8 JourneyTypes en producción:
 *   Conversacional → Conversational
 *   Viajero        → Traveler
 *   Negocios       → Business
 *   Expatriado     → Expat
 *   Académico      → Academic
 *   Cultural       → Cultural        (igual; omitido del map)
 *   Hospitalidad   → Hospitality
 *   Salud          → Health
 *
 * El slug (e.g. "academico" / "salud") NO se toca — sigue siendo el
 * de cuando se creó el row, así nada que dependa del slug se rompe.
 *
 * Usuarios EXISTENTES con journeys creados antes del rename siguen
 * viendo el nombre viejo en su mobile (label se cacheó al crear).
 * Recrear el journey lo actualiza.
 *
 * Corre con: `npx tsx scripts/renameStudioJourneysToEnglish.ts --apply`
 * Dry-run:   `npx tsx scripts/renameStudioJourneysToEnglish.ts`
 */

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";

config({ path: ".env.local" });
config({ path: ".env" });

const RENAMES: Record<string, string> = {
  "Conversacional": "Conversational",
  "Viajero":        "Traveler",
  "Negocios":       "Business",
  "Expatriado":     "Expat",
  "Académico":      "Academic",
  // "Cultural" idéntico en ambos idiomas — omitido del map.
  "Hospitalidad":   "Hospitality",
  "Salud":          "Health",
};

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();

  // 1) Journey rows
  const journeys = await prisma.journey.findMany({
    select: { id: true, name: true, language: true, variant: true },
    orderBy: [{ language: "asc" }, { name: "asc" }],
  });
  let journeyChanges = 0;
  console.log("== Journey rows ==");
  for (const j of journeys) {
    const newName = RENAMES[j.name];
    if (!newName) continue;
    journeyChanges += 1;
    console.log(
      `  [${(j.language ?? "?").padEnd(11)}|${(j.variant ?? "-").padEnd(8)}]  "${j.name}" → "${newName}"`
    );
    if (!apply) continue;
    await prisma.journey.update({ where: { id: j.id }, data: { name: newName } });
  }
  if (journeyChanges === 0) console.log("  (nothing to rename)");

  // 2) JourneyType rows (los 8 oficiales)
  const types = await prisma.journeyType.findMany({
    select: { id: true, slug: true, label: true },
    orderBy: { sortOrder: "asc" },
  });
  let typeChanges = 0;
  console.log("\n== JourneyType rows ==");
  for (const t of types) {
    const newLabel = RENAMES[t.label];
    if (!newLabel) continue;
    typeChanges += 1;
    console.log(`  [${t.slug.padEnd(15)}]  "${t.label}" → "${newLabel}"`);
    if (!apply) continue;
    await prisma.journeyType.update({ where: { id: t.id }, data: { label: newLabel } });
  }
  if (typeChanges === 0) console.log("  (nothing to rename)");

  const total = journeyChanges + typeChanges;
  console.log(
    !apply
      ? `\n${total} renames pendientes en total. Re-ejecuta con --apply.`
      : `\n✓ ${total} renames aplicados (${journeyChanges} Journey + ${typeChanges} JourneyType).\n` +
          "Usuarios con journeys existentes siguen viendo el nombre viejo (label se\n" +
          "cacheó al crear). Recrear el journey desde el panel lo actualiza."
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
