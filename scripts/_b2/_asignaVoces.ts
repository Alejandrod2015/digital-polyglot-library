/** Escribe el voiceId del narrador en las 21 historias del B2 latam, segun
 *  VOZ_POR_TEMA_B2_LATAM. Solo toca voiceId: ni texto ni vocab. Antes de escribir
 *  nada comprueba cada voz contra la lista de aprobadas y la de narradores
 *  vetados, y que la historia no tenga audio ni voz. No sintetiza nada.
 *    npx tsx scripts/_b2/_asignaVoces.ts [--apply] */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { assertVoiceApproved } from "../../src/lib/approvedVoices";
import { assertNarradorPermitido } from "../../src/lib/bannedNarrators";
import { VOZ_POR_TEMA_B2_LATAM } from "../_b2LatamVoces";

const J = "cmtpls1l20007j8epwgcs6e1h";
const p = new PrismaClient();
(async () => {
  const apply = process.argv.includes("--apply");
  for (const [tema, voz] of Object.entries(VOZ_POR_TEMA_B2_LATAM)) {
    assertVoiceApproved(voz, `b2-latam:${tema}`);
    assertNarradorPermitido(voz, `b2-latam:${tema}`);
  }
  const s = await p.journeyStory.findMany({
    where: { journeyId: J },
    select: { id: true, slug: true, topic: true, voiceId: true, audioUrl: true },
  });
  if (s.length !== 21) throw new Error(`esperaba 21 historias, hay ${s.length}`);
  const malas = s.filter((x) => x.audioUrl || x.voiceId || !VOZ_POR_TEMA_B2_LATAM[x.topic]);
  if (malas.length) throw new Error(`no cuadra el estado: ${malas.map((x) => x.slug).join(", ")}`);
  for (const x of s) {
    const voz = VOZ_POR_TEMA_B2_LATAM[x.topic];
    if (apply) await p.journeyStory.update({ where: { id: x.id }, data: { voiceId: voz } });
    console.log(`${x.topic}\t${x.slug}\t${voz}`);
  }
  console.log(apply ? "voces escritas: 21" : "--dry: comprobado, nada escrito");
  await p.$disconnect();
})();
