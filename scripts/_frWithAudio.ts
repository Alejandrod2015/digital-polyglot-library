import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmt09ehi60000320qf9efrypu", NOT: { audioUrl: null } }, select: { slug: true, topic: true, updatedAt: true } });
  st.sort((a, b) => +a.updatedAt - +b.updatedAt).forEach((s) => console.log(`${s.updatedAt.toISOString().slice(11, 19)}  ${s.topic.padEnd(24)} ${s.slug}`));
  await p.$disconnect();
})();
