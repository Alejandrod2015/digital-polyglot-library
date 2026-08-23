import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmt09ehi60000320qf9efrypu" }, select: { id: true, slug: true } });
  st.forEach(s => console.log(`${s.slug} ${s.id}`));
  await p.$disconnect();
})();
