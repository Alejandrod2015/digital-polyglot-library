import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const JID = "cmubidgaf0007j8np6g7n89iu";
  const st = await p.journeyStory.findMany({ where: { journeyId: JID }, select: { slug:true, title:true, topic:true, slotIndex:true, audioUrl:true } });
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "german-friends-a2", slug: "" } }, select: { slugs:true } });
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "german-friends-a2" }, select: { slug:true } });
  const conCapa = new Set(filas.map(f=>f.slug).filter(Boolean));
  const enBundle = new Set(g!.slugs);
  console.log("historia".padEnd(34) + "capa  enSlugs  audio  titulo");
  for (const s of st.sort((a,b)=>a.slug!.localeCompare(b.slug!)))
    console.log(`${s.slug!.padEnd(34)}${conCapa.has(s.slug!)?" si ":" NO "}  ${enBundle.has(s.slug!)?" si  ":" NO  "}  ${s.audioUrl?"si ":"no "}   ${s.title}`);
  const huerfanas = [...conCapa].filter(x => !st.some(s=>s.slug===x));
  const fuera = [...enBundle].filter(x => !st.some(s=>s.slug===x));
  console.log(`\ncapas de slugs que ya no existen: ${huerfanas.join(", ") || "ninguna"}`);
  console.log(`slugs del bundle que ya no existen: ${fuera.join(", ") || "ninguno"}`);
  await p.$disconnect();
})();
