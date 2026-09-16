import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st: any[] = await p.journeyStory.findMany({ where: { journeyId: "cmu0doigc0007j8e292tycths" },
    select: { slug:true, title:true, topic:true, coverUrl:true, coverDone:true, updatedAt:true } });
  console.log("con portada:", st.filter(s=>s.coverUrl).length, "/", st.length);
  for (const s of st.filter(s=>!s.coverUrl))
    console.log("FALTA:", s.topic, "|", s.slug, "|", s.title, "| coverDone:", s.coverDone, "| tocada:", s.updatedAt.toISOString().slice(0,16));
  await p.$disconnect();
})();
