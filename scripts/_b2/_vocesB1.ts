import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findMany({ where: { journeyId: "cmtmylg7k0007321h6t7njesx" }, select: { slug: true, voiceId: true, cast: true, audioUrl: true } });
  const conCast = s.filter((x) => x.cast && JSON.stringify(x.cast) !== "{}" && JSON.stringify(x.cast) !== "[]");
  console.log(`B1 latam: ${s.length} historias · con voiceId ${s.filter((x) => x.voiceId).length} · con cast ${conCast.length} · narradas ${s.filter((x) => x.audioUrl).length}`);
  if (conCast[0]) console.log("ejemplo de cast:", JSON.stringify(conCast[0].cast).slice(0, 300));
  await p.$disconnect();
})();
