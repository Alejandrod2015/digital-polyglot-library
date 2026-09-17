/** Los titulos del journey, para no repetir estructura ni fichas. El validador
 *  mira variedad de patron, monotonia de plantilla y solape de tokens, asi que
 *  titular sin leer los otros veinte es titular a ciegas. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
(async () => {
  const hs = await p.journeyStory.findMany({
    where: { journeyId: process.argv[2] },
    select: { slug: true, title: true, topic: true },
    orderBy: [{ topic: "asc" }, { title: "asc" }],
  });
  for (const h of hs) console.log(`${String(h.title?.length ?? 0).padStart(2)}  ${h.topic ?? "-"}  ${h.title}`);
  console.log(`\n${hs.length} historias`);
  await p.$disconnect();
})();
