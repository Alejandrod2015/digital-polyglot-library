import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
async function main() {
  const [id, out, topic] = process.argv.slice(2);
  const st = await p.journeyStory.findMany({
    where: { journeyId: id, ...(topic ? { topic } : {}), NOT: { text: null } },
    select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true },
    orderBy: { slotIndex: "asc" },
  });
  fs.writeFileSync(out, JSON.stringify(st, null, 2));
  console.log(st.length, "->", out);
}
main().finally(() => p.$disconnect());
