import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { audioUrl: true, audioStatus: true, audioWordTimings: true, audioFragments: true, voiceId: true } });
  const w = ((s!.audioWordTimings as any)?.words ?? []) as Array<{ text: string; endSec: number | null }>;
  const fr = (s!.audioFragments as any[]) ?? [];
  console.log(`estado ${s!.audioStatus} · voz ${s!.voiceId}`);
  console.log(`url ${s!.audioUrl}`);
  console.log(`fragmentos ${fr.length} · ultimo termina en ${fr[fr.length-1]?.endSec}s`);
  console.log(`palabras alineadas ${w.length} · ultima "${w[w.length-1]?.text}" a ${w[w.length-1]?.endSec}s · sin tiempo: ${w.filter(x=>x.endSec==null).length}`);
  await p.$disconnect();
})();
