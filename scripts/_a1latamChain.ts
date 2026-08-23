/** Encadena el Traveler ES/latam A0 con el A1 recien escrito. Solo toca
 *  `nextJourneyId`; no escribe contenido de historia. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A0 = "cmqrtaj1p000032qtda86z6um";
const A1 = "cmt5vxwgd0007324oesy195k8";
(async () => {
  const conTexto = await p.journeyStory.count({ where: { journeyId: A1, NOT: { text: null } } });
  if (conTexto < 21) throw new Error(`el A1 solo tiene ${conTexto} historias con texto; no se encadena en vacio`);
  await p.journey.update({ where: { id: A0 }, data: { nextJourneyId: A1 } });
  const j = await p.journey.findUnique({ where: { id: A0 }, select: { name: true, nextJourneyId: true } });
  console.log(`${j!.name} ES/latam a0 -> next=${j!.nextJourneyId} (${conTexto} historias con texto)`);
  await p.$disconnect();
})().catch(async (e) => { console.error(e.message ?? e); await p.$disconnect(); process.exit(1); });
