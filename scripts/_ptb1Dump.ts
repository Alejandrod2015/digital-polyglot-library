import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
async function main() {
  const st = await p.journeyStory.findMany({
    where: { journeyId: process.argv[2] },
    select: { slug: true, title: true, synopsis: true, text: true, vocab: true, topic: true, slotIndex: true, arcType: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  fs.writeFileSync(process.argv[3], JSON.stringify(st, null, 1));
  console.log(`${st.length} historias -> ${process.argv[3]}`);
}
main().catch((e) => console.error(String(e).slice(0, 500))).finally(() => p.$disconnect());
