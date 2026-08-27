/** Enseña la oración de cada aparición de una palabra en un bundle. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const [bundle, ...palabras] = process.argv.slice(2);
  const g = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
  const hist = await p.journeyStory.findMany({ where: { slug: { in: g!.slugs } }, select: { slug: true, title: true, text: true } });
  const glosas = g!.glosses as Record<string, any>;
  for (const w of palabras) {
    console.log(`\n== ${w}  [${glosas[w]?.t}] ${glosas[w]?.g}`);
    for (const h of hist) {
      for (const fr of `${h.title}. ${h.text}`.split(/(?<=[.!?])\s+/)) {
        if (new RegExp(`\\b${w}\\b`, "iu").test(fr)) console.log("   ", h.slug!.slice(0, 22).padEnd(23), fr.trim().slice(0, 95));
      }
    }
  }
  await p.$disconnect();
}
main();
