import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j: any = await p.journey.findUnique({ where: { id: "cmud5qhu00006j81cmkl4u5ks" } });
  if (!j) { console.log("NO JOURNEY"); return; }
  console.log(JSON.stringify(j, null, 1).slice(0, 2000));
  const st: any[] = await p.journeyStory.findMany({ where: { journeyId: j.id } });
  console.log("stories:", st.length);
  st.sort((a,b)=> (a.topicIndex-b.topicIndex) || (a.orderInTopic-b.orderInTopic) || a.slug.localeCompare(b.slug));
  for (const s of st) console.log([s.topicIndex, s.orderInTopic, s.slug, s.status, (s.vocab?.length ?? 0), (s.text||"").length, s.audioUrl?"AUDIO":"-"].join(" | "));
  const pe = await p.practiceExercise.count({ where: { story: { journeyId: j.id } } as any });
  console.log("practice exercises:", pe);
  const tg = await p.tapGlossSet.findMany({ where: { slug: { in: st.map(s=>s.slug) } } });
  console.log("tapGlossSets for these slugs:", tg.length, tg.map(t=>t.bundle).filter((v,i,a)=>a.indexOf(v)===i));
  await p.$disconnect();
})();
