/**
 * Reemplaza Liam (descartado) por Luca en el dialogueSpec de
 * cafe-in-kreuzberg. Liam estaba marcado `discarded` en el catálogo
 * desde la memoria "Acento gringo se cuela en eleven_multilingual_v2
 * cuando habla alemán" pero seguía casteado en producción.
 *
 *   elevenlabs/TX3LPaxmHKxFdv7VOQHJ (Liam, discarded)
 *     →  elevenlabs/mmAbrxFQ9xjByXyBpqrK (Luca, approved, native DE)
 *
 * Solo modifica `dialogueSpec`. El audio físico en R2 no se regenera;
 * el usuario dispara el regen vía Studio Audio cuando quiera. Idempotente.
 *
 * Corre con: `npx tsx scripts/applyCafeKreuzbergLuca.ts --apply`
 * Dry-run:   `npx tsx scripts/applyCafeKreuzbergLuca.ts`
 */

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";

config({ path: ".env.local" });
config({ path: ".env" });

type Segment = { text: string; voice: string; speaker?: string };

const SLUG = "cafe-in-kreuzberg";
const OLD_VOICE = "elevenlabs/TX3LPaxmHKxFdv7VOQHJ"; // Liam
const NEW_VOICE = "elevenlabs/mmAbrxFQ9xjByXyBpqrK"; // Luca

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();

  const story = await prisma.journeyStory.findFirst({
    where: { slug: { equals: SLUG, mode: "insensitive" } },
    select: { id: true, slug: true, title: true, dialogueSpec: true },
  });
  if (!story) {
    console.error(`Story ${SLUG} not found`);
    process.exit(1);
  }
  if (!Array.isArray(story.dialogueSpec)) {
    console.error(`${SLUG} has no dialogueSpec`);
    process.exit(1);
  }

  const oldSpec = story.dialogueSpec as unknown as Segment[];
  let changed = 0;
  const newSpec: Segment[] = oldSpec.map((seg) => {
    if (seg.voice === OLD_VOICE) {
      changed += 1;
      return { ...seg, voice: NEW_VOICE };
    }
    return seg;
  });

  console.log(`${SLUG}: ${changed}/${oldSpec.length} segmentos cambian de Liam a Luca`);

  const oldByVoice: Record<string, number> = {};
  const newByVoice: Record<string, number> = {};
  for (const s of oldSpec) oldByVoice[s.voice] = (oldByVoice[s.voice] ?? 0) + 1;
  for (const s of newSpec) newByVoice[s.voice] = (newByVoice[s.voice] ?? 0) + 1;
  console.log("  antes:");
  for (const [v, n] of Object.entries(oldByVoice)) console.log(`    ${n.toString().padStart(2)}× ${v}`);
  console.log("  después:");
  for (const [v, n] of Object.entries(newByVoice)) console.log(`    ${n.toString().padStart(2)}× ${v}`);

  if (changed === 0) {
    console.log("  (nada que aplicar — Liam ya no está)");
    await prisma.$disconnect();
    return;
  }
  if (!apply) {
    console.log("  [dry-run] no se escribe a DB. Re-ejecuta con --apply.");
    await prisma.$disconnect();
    return;
  }
  await prisma.journeyStory.update({
    where: { id: story.id },
    data: { dialogueSpec: newSpec as unknown as object },
  });
  console.log("  ✓ dialogueSpec actualizado en DB");
  console.log(
    "\nSiguiente paso: Studio Audio → cafe-in-kreuzberg → 'Regenerar audio'.\n"
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
