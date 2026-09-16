import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st: any[] = await p.journeyStory.findMany({ where: { journeyId: "cmu0doigc0007j8e292tycths" }, select: { slug:true, coverUrl:true, coverThumbhash:true } });
  const u = st.map(s=>s.coverUrl);
  console.log("historias:", st.length, "| urls distintas:", new Set(u).size, "| con thumbhash:", st.filter(s=>s.coverThumbhash).length);
  const dup = u.filter((x,i)=>u.indexOf(x)!==i);
  console.log("duplicadas:", dup.length ? dup.join(", ") : "ninguna");
  await p.$disconnect();
})();
