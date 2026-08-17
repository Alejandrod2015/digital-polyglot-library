import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const NAMES: Record<string,string> = {
  "FXGrCtY3PEyfqczBAlqm":"Jhenny (LATAM neutro)",
  "JW8DGEuLp9WxIS5IdxMM":"andreti (México)",
  "yHD4CsKkghm19ToGLJEC":"Hernando (Colombia)",
  "kIVGrdJmAh9zNqLfBLUo":"Giancarlos (Perú)",
  "MjtZn5tagxL1RO6w9ER5":"narrador AR",
  "yytxkT3pNVMWDHn3KXrY":"narrador CL",
};
(async () => {
  for (const lvl of ["a0","a1","a2"]) {
    const j = await prisma.journey.findFirst({ where: { status: "active", levels: { has: lvl } }, select: { id: true } });
    const stories = await prisma.journeyStory.findMany({ where: { journeyId: j!.id, status: "published" },
      select: { slug: true, voiceId: true, practiceVoiceId: true } });
    const agg = new Map<string, number>();
    for (const s of stories) {
      const effective = s.practiceVoiceId?.trim() || s.voiceId || "?";
      const label = `${NAMES[effective] ?? effective}${s.practiceVoiceId ? "" : " [sin override]"}`;
      agg.set(label, (agg.get(label) ?? 0) + 1);
    }
    console.log(lvl.toUpperCase() + ":", [...agg.entries()].map(([k,v]) => `${v}× ${k}`).join(" | "));
  }
})().finally(() => prisma.$disconnect());
