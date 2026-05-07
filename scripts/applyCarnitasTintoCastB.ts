/**
 * Aplica el cast B (100% LATAM) a Carnitas en Coyoacán y Tinto en La
 * Candelaria reescribiendo el `dialogueSpec` de cada story en DB.
 *
 * Decisión documentada en la conversación: reemplazar las 2 voces
 * `chatterbox/clone-*` (peninsular castellano) por voces aprobadas
 * latam para que ambas historias dejen de sonar a "personajes
 * españoles en LATAM" cuando el setting es Mexico/Colombia.
 *
 *   Carnitas en Coyoacán (mexico, 🟡 acceptable):
 *     narrator      → kokoro/ef_dora        (sin cambio, neutral-latam)
 *     Lucía         → chatterbox/co_cof_07508 (colombian, 🟡 acceptable)
 *     Don Felipe    → kokoro/em_alex        (neutral-latam, 🟡 acceptable)
 *
 *   Tinto en La Candelaria (colombia, 🟢/🟡):
 *     narrator      → kokoro/ef_dora        (sin cambio, neutral-latam)
 *     Marta         → chatterbox/co_cof_07508 (colombian, 🟢 perfect)
 *     Don Carlos    → kokoro/em_alex        (neutral-latam, 🟡 acceptable)
 *
 * Solo modifica `dialogueSpec`. El audio físico en R2 NO se regenera;
 * para eso el usuario tiene que abrir cada story en Studio → Audio
 * y picar "Regenerar audio" (o equivalente). Esto es intencional:
 * separar el cambio de cast del costo de Modal compute.
 *
 * Corre con: `npx tsx scripts/applyCarnitasTintoCastB.ts --apply`
 * Dry-run:   `npx tsx scripts/applyCarnitasTintoCastB.ts`
 */

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";

config({ path: ".env.local" });
config({ path: ".env" });

type Segment = { text: string; voice: string };

const REPLACEMENTS: Record<string, string> = {
  // OLD voiceId → NEW voiceId
  "chatterbox/clone-castile_38f-castellano-v2": "chatterbox/co_cof_07508",
  "chatterbox/clone-madrid_55m": "kokoro/em_alex",
};

const TARGET_SLUGS = ["carnitas-en-coyoacan", "tinto-en-la-candelaria"];

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();

  for (const slug of TARGET_SLUGS) {
    const story = await prisma.journeyStory.findFirst({
      where: { slug: { equals: slug, mode: "insensitive" } },
      select: { id: true, slug: true, title: true, dialogueSpec: true },
    });
    if (!story) {
      console.warn(`SKIP: story ${slug} not found`);
      continue;
    }
    if (!Array.isArray(story.dialogueSpec)) {
      console.warn(`SKIP: ${slug} has no dialogueSpec array`);
      continue;
    }
    const oldSpec = story.dialogueSpec as unknown as Segment[];
    let changed = 0;
    const newSpec: Segment[] = oldSpec.map((seg) => {
      if (typeof seg.voice !== "string") return seg;
      const replacement = REPLACEMENTS[seg.voice];
      if (replacement) {
        changed += 1;
        return { ...seg, voice: replacement };
      }
      return seg;
    });

    console.log(`\n${slug}: ${changed}/${oldSpec.length} segmentos van a cambiar de voz`);
    if (changed === 0) {
      console.log(`  (nada que aplicar)`);
      continue;
    }
    // Mostrar el diff por voiceId.
    const oldByVoice: Record<string, number> = {};
    const newByVoice: Record<string, number> = {};
    for (const s of oldSpec) oldByVoice[s.voice] = (oldByVoice[s.voice] ?? 0) + 1;
    for (const s of newSpec) newByVoice[s.voice] = (newByVoice[s.voice] ?? 0) + 1;
    console.log("  antes:");
    for (const [v, n] of Object.entries(oldByVoice)) console.log(`    ${n.toString().padStart(2)}× ${v}`);
    console.log("  después:");
    for (const [v, n] of Object.entries(newByVoice)) console.log(`    ${n.toString().padStart(2)}× ${v}`);

    if (!apply) {
      console.log(`  [dry-run] no se escribe a DB. Re-ejecuta con --apply.`);
      continue;
    }
    await prisma.journeyStory.update({
      where: { id: story.id },
      data: {
        dialogueSpec: newSpec as unknown as object,
        // No tocamos audioUrl/audioStatus: el audio sigue siendo el viejo
        // hasta que alguien dispare el regen. Esto es por diseño.
      },
    });
    console.log(`  ✓ dialogueSpec actualizado en DB`);
  }
  await prisma.$disconnect();
  console.log(
    "\nSiguiente paso: abre Studio Audio, encuentra estas 2 historias y dispara 'Regenerar audio' para cada una.\n" +
      "El nuevo audio se sube a R2 y reemplaza la URL automáticamente.\n"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
