import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const m: any = await import("@/lib/readerParagraphs");
  const J = "cmtgelq560007j84n3ujx9bpd";
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const ss = (await p.journeyStory.findMany({ where: { journeyId: J, NOT: { text: null } },
    select: { slug: true, text: true, topic: true, slotIndex: true } }))
    .sort((a,b)=>(j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  let total = 0;
  ss.forEach((s, i) => {
    const bl = m.renderedParagraphs(String(s.text)) as string[];
    // una tirada = bloque con 3 o mas citas y NADA de narracion entre ellas
    const malos = bl.filter((b) => {
      const citas = (String(b).match(/“[^”]*”/g) ?? []).length;
      const sinCita = String(b).replace(/“[^”]*”/g, "").replace(/[,.\s]/g, "");
      return citas >= 3 && sinCita.length < 12;
    });
    if (malos.length) { total += malos.length; console.log(`H${i+1} ${s.slug}: ${malos.length} tirada(s)`); console.log(`   ${malos[0].slice(0,100)}`); }
  });
  console.log(`\ntiradas de 3+ replicas sin narracion en medio: ${total}`);
})().finally(() => p.$disconnect());
