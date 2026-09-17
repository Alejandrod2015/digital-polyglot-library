import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const slug of process.argv.slice(2)) {
    const h = await p.journeyStory.findFirst({ where: { slug, journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { text: true, updatedAt: true } });
    console.log(`== ${slug} (updatedAt ${h?.updatedAt?.toISOString()})\n${(h?.text ?? "").split("\n\n").slice(-3).join("\n\n")}\n`);
  }
  await p.$disconnect();
})();
