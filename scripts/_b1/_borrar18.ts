/** Borra las 18 historias de Irene en Nerja. El journey se rehace en Granada con
 *  Celia; los tres huecos de `rooms-and-landlords` se quedan porque `saveStory`
 *  los sobrescribe con las historias nuevas. Respaldo previo en
 *  qa/respaldos/b1-spain-21-2026-09-04.json y en el worktree focused-nash. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const r = await p.journeyStory.deleteMany({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi", NOT: { topic: "rooms-and-landlords" } },
  });
  const quedan = await p.journeyStory.count({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" } });
  console.log(`borradas ${r.count} · quedan ${quedan}`);
  await p.$disconnect();
})();
