/**
 * SONDA, solo lectura. Lee el payload CRUDO de los ejercicios de una historia
 * del Friends FR A0 y dice, sin interpretar, que campos de audio tiene cada
 * uno. Existe porque el log de la tanda dijo "13/13 listos" en las 21
 * historias y el contador dice que no hay ni un clip de palabra: uno de los
 * dos miente, y esto mira el dato en vez de creerse a ninguno.
 *
 *   npx tsx scripts/_frA0/_sondaClips.ts [slug]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const JOURNEY = "cmtwo6cys0007j8yzg6ni3fsc";
const prisma = new PrismaClient();

(async () => {
  const slug = process.argv[2] ?? "treize-comme-avant";
  const story = await prisma.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug },
    select: {
      slug: true,
      practiceSet: { select: { id: true, exercises: { select: { id: true, word: true, type: true, payload: true } } } },
    },
  });
  if (!story?.practiceSet) throw new Error(`sin practice set: ${slug}`);
  console.log(`${story.slug} · set ${story.practiceSet.id} · ${story.practiceSet.exercises.length} ejercicios`);
  for (const e of story.practiceSet.exercises) {
    const ac = ((e.payload as any)?.audioClip ?? {}) as Record<string, unknown>;
    const campos = Object.keys(ac).join(",") || "(sin audioClip)";
    console.log(`  ${e.type.padEnd(20)} "${(e.word ?? "").slice(0, 18)}" -> ${campos}`);
  }

  // Recuento global, con la MISMA consulta que usa el contador: cuantos
  // meaning_in_context del journey tienen wordClipUrl.
  const todas = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { slug: true, practiceSet: { select: { exercises: { select: { type: true, payload: true } } } } },
  });
  let con = 0, sin = 0, conFrase = 0, sinFrase = 0;
  for (const s of todas) {
    for (const e of s.practiceSet?.exercises ?? []) {
      const ac = (e.payload as any)?.audioClip ?? {};
      if (e.type === "meaning_in_context") ac.wordClipUrl ? con++ : sin++;
      if (e.type === "fill_blank") ac.clipUrl ? conFrase++ : sinFrase++;
    }
  }
  console.log(`\npalabra: con ${con}, sin ${sin}`);
  console.log(`frase:   con ${conFrase}, sin ${sinFrase}`);
})().finally(() => prisma.$disconnect());
