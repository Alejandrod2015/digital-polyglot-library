/** Qué se dice en cada tramo del máster, para juzgar si un final que SUBE es
 *  uptalk o simplemente una pregunta. Solo lectura. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s: any = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { audioSegments: true } });
  const segs = (s.audioSegments as Array<{ startSec?: number; endSec?: number; text?: string }>) ?? [];
  const from = Number(process.argv[3] ?? 0), to = Number(process.argv[4] ?? 9999);
  segs.filter((g) => (g.endSec ?? 0) >= from && (g.startSec ?? 0) <= to)
      .forEach((g) => console.log(`${(g.startSec ?? 0).toFixed(1)}-${(g.endSec ?? 0).toFixed(1)}s  ${g.text}`));
  await p.$disconnect();
})();
