import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
type MP = { pairs?: Array<{ word?: string; wordClipUrl?: string | null }> };
(async () => {
  const ejs = await p.storyPracticeExercise.findMany({
    where: { type: "match_meaning", set: { story: { journey: { language: { equals: "portuguese", mode: "insensitive" } } } } },
    select: { payload: true },
  });
  const urls = ejs.flatMap((e) => ((e.payload as MP).pairs ?? []).map((x) => ({ w: x.word, u: x.wordClipUrl })));
  console.log(`pares: ${urls.length} · con clip: ${urls.filter((x) => x.u).length}`);
  for (const x of urls.slice(0, 3)) {
    const r = await fetch(x.u!, { method: "GET" });
    const b = await r.arrayBuffer();
    console.log(`  ${x.w}: HTTP ${r.status} · ${b.byteLength} bytes · ${r.headers.get("content-type")}`);
  }
})().finally(() => p.$disconnect());
