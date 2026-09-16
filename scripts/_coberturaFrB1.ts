import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st: any[] = await p.journeyStory.findMany({
    where: { journeyId: "cmu0doigc0007j8e292tycths" }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { slug:true, practiceSet:{ select:{ exercises:{ select:{word:true,type:true,payload:true} } } } } });
  let bloq = 0; const pend: string[] = [];
  for (const s of st) {
    const ex = (s.practiceSet?.exercises ?? []) as any[];
    const mic = ex.filter(e=>e.type==="meaning_in_context");
    const fb  = ex.filter(e=>e.type==="fill_blank");
    const w   = mic.filter(e=>e.payload?.audioClip?.wordClipUrl).length;
    const f   = fb.filter(e=>e.payload?.audioClip?.clipUrl).length;
    const miss = (mic.length-w)+(fb.length-f);
    bloq += miss;
    if (miss) pend.push(s.slug);
    console.log(`${miss?"FALTA":"  ok "} ${s.slug.padEnd(28)} palabras ${w}/${mic.length}  frases_hueco ${f}/${fb.length}`);
  }
  console.log(`\nhuecos que bloquean publish: ${bloq}`);
  console.log(`historias pendientes: ${pend.join(" ") || "ninguna"}`);
  await p.$disconnect();
})();
