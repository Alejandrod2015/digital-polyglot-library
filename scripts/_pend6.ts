import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const filas = await p.tapGlossSet.findMany({ where: { slug: "" }, select: { bundle: true, slugs: true, glosses: true } });
  const objetivos: Array<[string, string, string, string]> = [
    ["spanish", "latam", "a1", "spanish-traveler-latam"],
    ["spanish", "spain", "a2", "spanish-traveler-spain-a2"],
  ];
  for (const [lang, vari, lvl, bundle] of objetivos) {
    const g = filas.find((f) => f.bundle === bundle)!;
    const mapa = g.glosses as Record<string, unknown>;
    const js = await p.journey.findMany({
      where: { status: { in: ["active", "draft"] }, language: lang, variant: vari, levels: { has: lvl } },
      select: { stories: { select: { slug: true, title: true, text: true } } },
    });
    const hist = js.flatMap((j) => j.stories);
    const enSlugs = hist.filter((s) => g.slugs.includes(s.slug!)).length;
    const faltan = new Set<string>();
    let total = 0;
    for (const s of hist) {
      for (const w of ((s.title + " " + s.text).match(/\p{L}+/gu) ?? [])) {
        total++;
        const k = w.toLowerCase();
        if (!mapa[k]) faltan.add(k);
      }
    }
    console.log(`${bundle}: ${hist.length} historias, ${enSlugs} ya en el array de slugs`);
    console.log(`  ${total} tokens, ${faltan.size} palabras SIN glosa global`);
    console.log("  " + [...faltan].sort().slice(0, 40).join(" "));
  }
  await p.$disconnect();
}
main();
