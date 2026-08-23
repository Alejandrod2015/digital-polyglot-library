import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmt09ehi60000320qf9efrypu" }, select: { slug: true, voiceId: true, practiceVoiceId: true } });
  const v = new Map<string, number>();
  st.forEach(s => v.set(String(s.voiceId), (v.get(String(s.voiceId)) ?? 0) + 1));
  console.log([...v].map(([k, n]) => `${k}: ${n}`).join("\n"));
  await p.$disconnect();
})();
