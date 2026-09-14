import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmu04ereh000732z7px7naqa2" } });
  console.log(JSON.stringify(j, null, 1).slice(0, 1500));
  const s = await p.journeyStory.findMany({ where: { journeyId: "cmu04ereh000732z7px7naqa2" }, orderBy: [{ slotIndex: "asc" }], select: { slug: true, title: true, topic: true, slotIndex: true, audioUrl: true, coverUrl: true, text: true, status: true } as any });
  let tot = 0;
  const topics: string[] = [];
  for (const x of s as any[]) { if (!topics.includes(x.topic)) topics.push(x.topic); }
  for (const t of topics) for (const x of (s as any[]).filter(y => y.topic === t)) {
    const c = (x.title?.length ?? 0) + (x.text?.length ?? 0); tot += c;
    console.log([t, x.slotIndex, x.slug, x.title, x.status, c, x.audioUrl ? "AUDIO" : "-", x.coverUrl ? "cover" : "-", x.text?.split(/\n\n+/)[0].length].join(" | "));
  }
  console.log("n=", s.length, "chars total", tot);
})().finally(() => p.$disconnect());
