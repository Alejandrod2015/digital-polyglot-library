import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmt09ehi60000320qf9efrypu" }, select: { slug: true, title: true, text: true, audioUrl: true } });
  const chars = st.reduce((a, s) => a + (s.text?.length ?? 0) + (s.title?.length ?? 0), 0);
  console.log(`${st.length} historias · ${chars} caracteres de narracion · con audio ya: ${st.filter(s => s.audioUrl).length}`);
  await p.$disconnect();
})();
