/** Como entra CADA personaje en su primera historia: el sintagma que dice QUE
 *  ES. El gate `journey-character-introduction` acepta cualquier verbo de la
 *  lista detras del nombre, asi que "Irene lleva dos semanas oyendo" pasaba sin
 *  presentar a nadie. Esto imprime la frase para leerla. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const id = process.argv[2] ?? "cmt70xfyt000l3283gxd70wck";
  const j = await p.journey.findUnique({ where: { id }, select: { topics: true } });
  const st = (await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } }, select: { slug: true, text: true, topic: true, slotIndex: true } }))
    .sort((a, b) => (j!.topics.indexOf(a.topic) - j!.topics.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const vistos = new Set<string>();
  for (const s of st) for (const n of ["Irene","Rocío","Quique","Rosa","Marta","Álvaro"]) {
    if (vistos.has(n) || !s.text!.includes(n)) continue;
    vistos.add(n);
    const f = s.text!.split(/(?<=[.!?”])\s+/).find((x) => x.includes(n)) ?? "";
    console.log(`${n.padEnd(8)} ${s.slug!.padEnd(28)} ${f.trim().slice(0, 96)}`);
  }
})().finally(() => p.$disconnect());
