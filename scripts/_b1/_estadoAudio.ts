import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findUnique({
    where: { id: "cmt5x686y000n320cyme6dmrl" },
    select: { audioUrl: true, audioStatus: true, audioSegments: true, audioFragments: true, audioWordTimings: true, voiceId: true, audioQaStatus: true },
  });
  const n = (x: any) => (Array.isArray(x) ? x.length : x == null ? "null" : "obj");
  console.log("url:", s?.audioUrl);
  console.log("status:", s?.audioStatus, "| voz:", s?.voiceId, "| qa:", s?.audioQaStatus);
  console.log("segments:", n(s?.audioSegments), "| fragments:", n(s?.audioFragments), "| wordTimings:", n(s?.audioWordTimings));
  const wt: any = s?.audioWordTimings;
  if (wt && !Array.isArray(wt)) console.log("wordTimings keys:", Object.keys(wt), "| palabras:", wt.words?.length);
  await p.$disconnect();
})();
