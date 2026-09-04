/** Los bloques que PINTA el lector para una historia, con su cuenta de vocab. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { title: true, text: true } });
  renderedParagraphs(s?.text ?? "").forEach((b, i) => console.log(`--- bloque ${i + 1} ---\n${b}\n`));
  await p.$disconnect();
})();
