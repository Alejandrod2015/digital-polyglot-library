import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { writeFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st: any[] = await p.journeyStory.findMany({
    where: { journeyId: "cmu0doigc0007j8e292tycths" },
    select: { practiceSet: { select: { exercises: { select: { word:true, type:true, payload:true } } } } } });
  const all = st.flatMap(s => (s.practiceSet?.exercises ?? []) as any[])
    .filter(e => e.type === "meaning_in_context" && e.payload?.audioClip?.wordClipUrl);
  // 14 repartidos por el catalogo: son clips que el gate YA aprobo (no suben)
  const step = Math.floor(all.length / 14);
  const pick = Array.from({length:14},(_,i)=>all[i*step]).filter(Boolean);
  for (const e of pick) {
    const url = e.payload.audioClip.wordClipUrl;
    const r = await fetch(url);
    const name = String(e.word).normalize("NFD").replace(/[^a-zA-Z ]/g,"").trim().replace(/\s+/g,"-").toLowerCase();
    writeFileSync(`scripts/_f0fixtures/aprobado_${name}.mp3`, Buffer.from(await r.arrayBuffer()));
    console.log("bajado:", name);
  }
  await p.$disconnect();
})();
