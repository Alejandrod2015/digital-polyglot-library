// SOLO LECTURA. Estado del encargo: journey, historias y filas del bundle.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmtrcpgso00073232h8vaf7na" } });
  console.log(JSON.stringify(j, null, 0).slice(0, 600));
  const st = await p.journeyStory.findMany({ where: { topic: { journeyId: "cmtrcpgso00073232h8vaf7na" } } as never, select: { slug: true } }).catch((e) => { console.log(String(e).slice(0, 300)); return []; });
  console.log("historias", st.length);
  const rows = await p.tapGlossSet.findMany({ where: { bundle: "portuguese-traveler-brazil-b1" }, select: { slug: true, slugs: true } });
  console.log("filas bundle", rows.length, JSON.stringify(rows.map((r) => r.slug)));
  console.log("slugs global", JSON.stringify(rows.find((r) => !r.slug)?.slugs));
  await p.$disconnect();
})();
