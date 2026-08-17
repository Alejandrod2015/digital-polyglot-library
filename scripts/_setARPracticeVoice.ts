/**
 * Setea practiceVoiceId = Jhenny (LATAM) en las 21 historias de Friends ES
 * Argentina C1 (hoy null). Pre-paso para el audio de práctica. NO gastа
 * créditos (solo DB). Correr antes de _genPracticeClips.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const JOURNEY_ID = "cmrqn1s5s000032tj3kq0gykb";
const JHENNY = "FXGrCtY3PEyfqczBAlqm"; // practice LATAM, APROBADA
(async () => {
  const p = new PrismaClient();
  const r = await p.journeyStory.updateMany({ where: { journeyId: JOURNEY_ID }, data: { practiceVoiceId: JHENNY } });
  console.log(`practiceVoiceId=Jhenny seteado en ${r.count} historias`);
  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
