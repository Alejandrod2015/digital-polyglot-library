/** Los huecos vacios que faltan del B1 ES/Spain, bajo los siete temas del journey.
 *  Sin texto ni vocab: el contenido entra por saveStory.ts y por ningun otro sitio. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const J = "cmt5x67ze000l320cpgunu5vi";
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  let n = 0;
  for (const t of j!.topics) for (let i = 1; i <= 3; i++) {
    if (await p.journeyStory.findFirst({ where: { journeyId: J, topic: t, slotIndex: i } })) continue;
    await p.journeyStory.create({ data: { journeyId: J, level: "b1", topic: t, slotIndex: i, status: "draft" } });
    n++;
  }
  console.log(`huecos creados: ${n} · total ahora: ${await p.journeyStory.count({ where: { journeyId: J } })}`);
})().finally(() => p.$disconnect());
