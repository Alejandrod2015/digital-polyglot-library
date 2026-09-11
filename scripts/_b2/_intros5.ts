import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const SLUGS = ["la-cortesia-mas-cara","la-otra-columna","aqui-se-dice-arrendando","vitel-tone-con-blanco","de-medio-metro-y-gracias"];
const p = new PrismaClient();
(async () => {
  const hs = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h", slug: { in: SLUGS } }, select: { slug: true, text: true, vocab: true } });
  for (const s of SLUGS) { const h = hs.find(x=>x.slug===s)!; console.log(`\n#### ${s}\n${h.text}`); }
  await p.$disconnect();
})();
