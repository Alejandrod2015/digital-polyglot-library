import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmtplpfum0007j8c6piegwt31" }, select: { name: true, language: true, variant: true, levels: true, status: true } });
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmtplpfum0007j8c6piegwt31" }, select: { text: true, audioUrl: true, coverUrl: true } });
  console.log(JSON.stringify(j), "| historias", st.length, "| con texto", st.filter((s) => s.text?.trim()).length, "| narradas", st.filter((s) => s.audioUrl).length, "| covers", st.filter((s) => s.coverUrl).length);
  await p.$disconnect();
})();
