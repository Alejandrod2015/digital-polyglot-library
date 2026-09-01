import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const m: any = await import("@/lib/readerParagraphs");
  const s = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { text: true } });
  const bloques = m.renderedParagraphs(String(s!.text));
  console.log(`bloques que ve el lector: ${bloques.length}`);
  bloques.forEach((b: any, i: number) => console.log(`[${i + 1}] ${String(b).slice(0, 90)}`));
})().finally(() => p.$disconnect());
