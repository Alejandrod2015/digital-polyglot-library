import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const s = await prisma.journeyStory.findFirst({ where: { slug: "la-promesa-del-mole" }, select: { audioUrl: true, audioSegments: true, audioStatus: true, voiceId: true } });
  console.log("audioUrl:", s?.audioUrl ? s.audioUrl.slice(0,80) : null);
  console.log("audioStatus:", s?.audioStatus, "voiceId:", s?.voiceId);
  const segs = (s?.audioSegments as any[]) || [];
  console.log("segments:", segs.length);
  // print segments that contain 'pedimos' or 'pedir' or other vocab
  for (const [i, seg] of segs.entries()) {
    const t = (seg.text || seg.line || seg.sentence || "").toString();
    if (/pedimos|comida|mercado|cenar|colgar|cuelga|quemaste|suerte|sospecha/i.test(t)) {
      console.log(`  [${i}] start=${seg.start ?? seg.startSec} end=${seg.end ?? seg.endSec} :: ${t.slice(0,70)}`);
    }
  }
  console.log("--- sample segment shape ---");
  console.log(JSON.stringify(segs[0] ?? {}, null, 1).slice(0, 400));
  await prisma.$disconnect();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
