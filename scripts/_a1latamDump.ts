import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A0 = "cmqrtaj1p000032qtda86z6um";
(async () => {
  const j = await p.journey.findUnique({ where: { id: A0 } });
  console.log("JOURNEY", JSON.stringify({ name: j!.name, typeSlug: j!.typeSlug, levels: j!.levels, topics: j!.topics, spt: j!.storiesPerTopic, status: j!.status, next: j!.nextJourneyId }, null, 1));
  const st = await p.journeyStory.findMany({ where: { journeyId: A0 }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  const orden = j!.topics;
  st.sort((a,b) => (orden.indexOf(a.topic)-orden.indexOf(b.topic)) || (a.slotIndex-b.slotIndex));
  const words = new Set<string>();
  let plazas = 0;
  for (const s of st) {
    const v = (s.vocab as any[]) ?? [];
    plazas += v.length;
    for (const x of v) words.add(String(x.word));
    console.log(`\n--- ${s.topic}#${s.slotIndex} [${s.status}] ${s.slug}`);
    console.log(`    ${s.title}  | wc=${String(s.text??"").trim().split(/\s+/).length} | arc=${s.arcType} | vocab=${v.length}`);
    console.log(`    vocab: ${v.map((x)=>x.word).join(", ")}`);
  }
  console.log(`\nTOTAL plazas=${plazas} distintas=${words.size}`);
  await p.$disconnect();
})();
