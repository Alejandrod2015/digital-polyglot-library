import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const s = await prisma.journeyStory.findFirst({ where: { slug: "la-combi-equivocada" },
    select: { id: true, voiceId: true, dialogueSpec: true } });
  console.log("id:", s?.id, "voiceId:", s?.voiceId);
  const spec = (s?.dialogueSpec as any[]) || [];
  const seen = new Map<string, string>();
  for (const seg of spec) if (!seen.has(seg.speaker?.toLowerCase())) seen.set(seg.speaker?.toLowerCase(), seg.voice);
  for (const [sp, v] of seen) console.log(sp, "->", v);
})().finally(() => prisma.$disconnect());
