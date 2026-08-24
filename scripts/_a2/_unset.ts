import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const id = process.argv[2];
  await p.journeyStory.update({ where: { id }, data: { coverUrl: null, coverDone: false } });
  console.log("UNSET " + id);
})().finally(() => p.$disconnect());
