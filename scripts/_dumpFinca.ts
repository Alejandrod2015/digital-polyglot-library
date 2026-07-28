import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const r = await p.catalogStory.findFirst({ where: { slug: "la-finca-en-la-montana" }, select: { text: true, vocab: true } });
  writeFileSync(process.argv[2], r!.text);
  writeFileSync(process.argv[3], JSON.stringify(r!.vocab, null, 1));
  await p.$disconnect();
})();
