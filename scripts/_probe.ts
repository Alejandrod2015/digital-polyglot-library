import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const m: any = await import("@/lib/validateJourneyStories");
  const j = await p.journey.findUnique({ where: { id: "cmtgelq560007j84n3ujx9bpd" }, select: { topics: true } });
  const filas = (await p.journeyStory.findMany({ where: { journeyId: "cmtgelq560007j84n3ujx9bpd", NOT: { text: null } },
    select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true } }))
    .sort((a,b)=>(j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const st = filas.map(f => ({ slug: f.slug!, title: f.title ?? "", text: f.text!, vocab: f.vocab as never, language: "ES", level: "a2", topic: f.topic }));
  const cs = m.validateJourneyStories(st, { language: "ES", level: "a2" });
  for (const c of cs) if (c.id.startsWith("journey-cast")) console.log(c.status, c.id, c.detail ?? "");
})().finally(() => p.$disconnect());
