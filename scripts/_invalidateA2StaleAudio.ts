/**
 * Invalida los mp3 del Traveler ES/Spain A2 que se renderizaron con el reparto
 * ANTERIOR (narrador 4R9s73RrCF4wi6GqmzrT y 13 voces de personaje, ninguna en
 * la allowlist). Tras el recast, `voiceId` apunta a una voz aprobada pero el
 * audio en R2 sigue siendo el viejo: una fila `audioStatus=ready` con voz
 * aprobada y un mp3 no aprobado es justo la combinación que se cuela en una
 * publicación sin que nadie lo note.
 *
 * NO borra nada en R2. Solo suelta el puntero y deja la URL anotada en
 * `audioEditorNote`, que es campo de operador y no lo pisa ni la generación ni
 * el QA. Recuperar es copiar la URL de vuelta.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const JOURNEY = "cmqc6tojm000032el2ebwsgkn";
const OLD_NARRATOR = "4R9s73RrCF4wi6GqmzrT";
const apply = process.argv.includes("--apply");

async function run() {
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY, audioUrl: { not: null } },
    select: { id: true, slug: true, audioUrl: true, audioStatus: true, audioEditorNote: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });

  console.log(`historias con audio viejo: ${stories.length}\n`);
  for (const s of stories) {
    const note = [
      s.audioEditorNote,
      `[recast 2026-08-15] audio invalidado: se renderizó con el reparto previo (narrador ${OLD_NARRATOR}, no aprobado). URL anterior: ${s.audioUrl}`,
    ].filter(Boolean).join("\n");
    console.log(`${s.slug.padEnd(28)} ${s.audioStatus} → pending   url soltada y anotada`);
    if (apply) {
      await prisma.journeyStory.update({
        where: { id: s.id },
        data: {
          audioUrl: null,
          audioFilename: null,
          audioSegments: undefined,
          audioStatus: "pending",
          audioQaStatus: null,
          audioEditorNote: note,
        },
      });
    }
  }
  console.log(apply ? `\ninvalidadas ${stories.length}` : `\n(dry run; añade --apply para escribir)`);
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
