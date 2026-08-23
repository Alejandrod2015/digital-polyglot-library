import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmt09ehi60000320qf9efrypu" }, select: { vocab: true } });
  const all = st.flatMap(s => ((s.vocab as any[]) ?? []));
  for (const w of process.argv.slice(2)) {
    const hit = all.filter(v => String(v.word).toLowerCase().includes(w.toLowerCase()));
    console.log(w, "->", hit.map(h => `${h.word}[${h.type}]`).join(", ") || "LIBRE");
  }
  await p.$disconnect();
})();
