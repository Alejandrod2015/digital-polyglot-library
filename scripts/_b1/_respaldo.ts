import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const ss = await p.journeyStory.findMany({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" } });
  const f = `qa/respaldos/b1-spain-21-${new Date().toISOString().slice(0, 10)}.json`;
  fs.writeFileSync(f, JSON.stringify(ss, null, 1));
  console.log(`${ss.length} historias respaldadas en ${f}`);
  await p.$disconnect();
})();
