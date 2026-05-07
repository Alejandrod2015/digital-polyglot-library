/**
 * Renombra los Studio Journey rows que tienen `name` en español a su
 * equivalente en inglés, para que el card del journey en la app
 * (que copia ese name al crear un journey) sea consistente con el
 * resto del UI ("Spanish"/"Portuguese"/"German" en lugar de mezclar
 * "Spanish" con "Viajero").
 *
 *   "Viajero"        → "Traveler"
 *   "Conversacional" → "Conversational"
 *
 * Usuarios EXISTENTES con journeys creados antes del rename siguen
 * viendo "Viajero" en su card porque `journey.label` se copia al
 * crear (no se referencia live). Para verlo actualizado, borrar y
 * recrear el journey desde el panel.
 *
 * Corre con: `npx tsx scripts/renameStudioJourneysToEnglish.ts --apply`
 * Dry-run:   `npx tsx scripts/renameStudioJourneysToEnglish.ts`
 */

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";

config({ path: ".env.local" });
config({ path: ".env" });

const RENAMES: Record<string, string> = {
  "Viajero": "Traveler",
  "Conversacional": "Conversational",
};

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();

  const journeys = await prisma.journey.findMany({
    select: { id: true, name: true, language: true, variant: true },
    orderBy: [{ language: "asc" }, { name: "asc" }],
  });

  let totalChanges = 0;
  for (const j of journeys) {
    const newName = RENAMES[j.name];
    if (!newName) continue;
    totalChanges += 1;
    console.log(
      `  [${(j.language ?? "?").padEnd(11)}|${(j.variant ?? "-").padEnd(8)}]  "${j.name}" → "${newName}"`
    );
    if (!apply) continue;
    await prisma.journey.update({
      where: { id: j.id },
      data: { name: newName },
    });
  }

  if (totalChanges === 0) {
    console.log("  (nothing to rename — already in English or no matches)");
  } else if (!apply) {
    console.log(`\n${totalChanges} renames pendientes. Re-ejecuta con --apply.`);
  } else {
    console.log(`\n✓ ${totalChanges} journeys renamed in DB.`);
    console.log(
      "Ojo: los usuarios con journeys existentes siguen viendo el nombre viejo en\n" +
        "su mobile (label se cachea al crear). Recrear el journey lo actualiza."
    );
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
