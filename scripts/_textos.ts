/** Vuelca { slug: "titulo. texto" } de las historias de un bundle, que es lo
 *  que come buildGlossForms.ts. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const [bundle, salida] = process.argv.slice(2);
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
  const hist = await p.journeyStory.findMany({ where: { slug: { in: g!.slugs } }, select: { slug: true, title: true, text: true } });
  const out: Record<string, string> = {};
  for (const h of hist) out[h.slug!] = `${h.title}. ${h.text}`;
  fs.writeFileSync(salida, JSON.stringify(out, null, 1));
  console.log(`${Object.keys(out).length} historias -> ${salida}`);
  await p.$disconnect();
}
main();
