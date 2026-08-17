/**
 * Escribe un `dialogueSpec` de narrador para prosa narrada que no lo tiene.
 *
 * POR QUÉ (2026-08-17). Las 3 historias de meeting-people del A0 portugués se
 * renderizaron por la rama de voz única, que devuelve un máster de una pieza y
 * no escribe `audioFragments`. Sin fragmentos no hay dónde empalmar, así que
 * corregir una frase obligaba a rehacer la historia entera y a pagarla entera.
 * `backfillAudioSections.ts` sabe recuperar los fragmentos de un máster ya
 * pagado, pero necesita el `dialogueSpec` para saber qué texto espera en cada
 * tramo, y el de voz única nunca lo escribió.
 *
 * Esto es exactamente lo que hace la ruta de Studio (journeys/audio) cuando se
 * encuentra prosa sin spec: parsea el texto en segmentos y les asigna la voz
 * del narrador (la de la historia o, si no la tiene, la de sus hermanas
 * publicadas del mismo journey). No sintetiza nada: cero créditos.
 *
 *   npx tsx scripts/_narratorSpec.ts <slug> [<slug>...] [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { parseDialogueSegments } from "../src/lib/elevenlabs";

const prisma = new PrismaClient();

async function main() {
  const dry = process.argv.includes("--dry");
  const slugs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!slugs.length) throw new Error("uso: _narratorSpec.ts <slug> [<slug>...] [--dry]");

  for (const slug of slugs) {
    const story = await prisma.journeyStory.findFirst({
      where: { slug },
      select: { id: true, journeyId: true, text: true, voiceId: true, dialogueSpec: true },
    });
    if (!story) { console.log(`${slug}: no existe`); continue; }

    const actual = story.dialogueSpec as unknown[] | null;
    if (Array.isArray(actual) && actual.length > 0) {
      console.log(`${slug}: ya tiene dialogueSpec (${actual.length} segmentos), no se toca`);
      continue;
    }

    let voz = story.voiceId?.replace(/^elevenlabs\//, "").trim() || "";
    if (!voz) {
      const hermana = await prisma.journeyStory.findFirst({
        where: { journeyId: story.journeyId, status: "published", voiceId: { not: null } },
        select: { voiceId: true },
      });
      voz = hermana?.voiceId?.replace(/^elevenlabs\//, "").trim() || "";
    }
    if (!voz) { console.log(`${slug}: sin voz de narrador ni en la historia ni en sus hermanas`); continue; }

    const segmentos = parseDialogueSegments(story.text);
    if (!segmentos.length) { console.log(`${slug}: el texto no produjo segmentos`); continue; }
    const spec = segmentos.map((s) => ({ speaker: s.speaker, voice: voz, text: s.text }));

    console.log(`${slug}: ${spec.length} segmentos, voz ${voz}`);
    for (const s of spec) console.log(`   ${s.speaker.padEnd(9)} ${s.text.slice(0, 60)}`);
    if (dry) continue;
    await prisma.journeyStory.update({ where: { id: story.id }, data: { dialogueSpec: spec as never } });
    console.log(`   escrito`);
  }
}

main()
  .catch((e) => { console.error("FALLÓ:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
