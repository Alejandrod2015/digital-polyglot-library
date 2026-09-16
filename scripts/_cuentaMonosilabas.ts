import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const js: any[] = await p.journey.findMany({ where: { status: "active" },
    select: { id:true, language:true, variant:true, levels:true } });
  console.log("journeys vivos:", js.length);
  let total = 0;
  for (const j of js) {
    const st: any[] = await p.journeyStory.findMany({ where: { journeyId: j.id },
      select: { practiceSet: { select: { exercises: { select: { word:true, type:true, payload:true } } } } } });
    const clips = st.flatMap(s => (s.practiceSet?.exercises ?? []) as any[])
      .filter(e => e.type === "meaning_in_context" && e.payload?.audioClip?.wordClipUrl);
    // candidatas a silaba suelta por el TEXTO: una sola palabra corta.
    const cortas = clips.filter(e => !/\s/.test(String(e.word).trim()) && String(e.word).trim().length <= 8);
    total += clips.length;
    console.log(`${(j.language+"/"+j.variant).padEnd(22)} ${String((j.levels ?? [])).padEnd(6)} clips ${String(clips.length).padStart(4)}  1-palabra-corta ${cortas.length}`);
  }
  console.log("TOTAL clips de palabra publicados en vivos:", total);
  await p.$disconnect();
})();
