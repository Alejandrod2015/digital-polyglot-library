/**
 * Cambia el ORDEN de lectura de dos historias de un tema (solo `slotIndex`).
 * No toca texto, vocab, audio ni portadas: cada historia se lleva lo suyo.
 * Autorizado por el chat de planificacion el 2026-09-24 para cerrar
 * `journey-cast-one-new-per-topic` en el Friends ES colombia C1, donde Salo
 * se estrenaba en la segunda de medellin en vez de en la primera.
 */
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
// Segundo swap, 2026-09-24: Expat DE germany C1 (draft, sin audio ni
// portadas). Su primera historia llevaba tres personajes; la segunda del
// mismo tema lleva dos, y la tercera se queda donde esta, que es la que va
// narrada en pasado.
const JOURNEY = "cmrdbz11t000032asrvo832i9";
const TEMA = "ankommen-im-norden";
const [A, B] = [1, 2];

async function main() {
  const st = await p.journeyStory.findMany({ where: { journeyId: JOURNEY, topic: TEMA },
    orderBy: { slotIndex: "asc" }, select: { id: true, slug: true, slotIndex: true, level: true } });
  console.log("antes:", st.map((s) => `${s.slotIndex}:${s.slug}`).join("  "));
  const a = st.find((s) => s.slotIndex === A)!, b = st.find((s) => s.slotIndex === B)!;
  await p.$transaction([
    p.journeyStory.update({ where: { id: a.id }, data: { slotIndex: 99 } }),
    p.journeyStory.update({ where: { id: b.id }, data: { slotIndex: A } }),
    p.journeyStory.update({ where: { id: a.id }, data: { slotIndex: B } }),
  ]);
  const st2 = await p.journeyStory.findMany({ where: { journeyId: JOURNEY, topic: TEMA },
    orderBy: { slotIndex: "asc" }, select: { slug: true, slotIndex: true } });
  console.log("despues:", st2.map((s) => `${s.slotIndex}:${s.slug}`).join("  "));
}
main().finally(() => p.$disconnect());
