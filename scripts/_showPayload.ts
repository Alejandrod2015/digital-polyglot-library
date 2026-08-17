import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const e = await p.storyPracticeExercise.findUnique({ where: { id: "spe_mrwd2yf3edifjmd" }, select: { payload: true } });
  console.log(JSON.stringify(e?.payload, null, 2));
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
