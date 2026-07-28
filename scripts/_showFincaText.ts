import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const r = await p.catalogStory.findFirst({ where: { slug: "la-finca-en-la-montana" }, select: { title: true, text: true, vocab: true } });
  console.log("TITULO:", JSON.stringify(r?.title));
  console.log("PRIMEROS 700 CHARS DEL TEXTO:\n", r?.text.slice(0, 700));
  console.log("\nVOCAB (primeras 6):");
  const v = Array.isArray(r?.vocab) ? (r!.vocab as Array<Record<string, unknown>>) : [];
  for (const x of v.slice(0, 6)) console.log("  ", JSON.stringify(x));
  console.log("total vocab:", v.length);
  await p.$disconnect();
})();
