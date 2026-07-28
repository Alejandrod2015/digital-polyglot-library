/** ¿El volcado estático de src/data/books conserva un texto MAS LARGO que el
 * de la base? Si es así, las historias con texto recortado se arreglan solas. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { books } from "../src/data/books";
const p = new PrismaClient();
const slugs = process.argv[2].split(",");
const wc = (s: string) => s.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
(async () => {
  const dump = new Map<string, string>();
  for (const b of Object.values(books)) for (const s of b.stories) if (s.slug && s.text) dump.set(s.slug, s.text);
  console.log(`${"historia".padEnd(36)}${"base".padStart(8)}${"volcado".padStart(9)}${"veredicto".padStart(24)}`);
  for (const slug of slugs) {
    const row = await p.catalogStory.findFirst({ where: { slug }, select: { text: true } });
    const d = dump.get(slug);
    const a = row?.text ? wc(row.text) : 0;
    const b = d ? wc(d) : 0;
    const verdict = !d ? "no esta en el volcado" : b > a * 1.2 ? "VOLCADO MAS LARGO" : b < a * 0.9 ? "volcado mas corto" : "iguales";
    console.log(`${slug.slice(0, 35).padEnd(36)}${String(a).padStart(8)}${String(b).padStart(9)}${verdict.padStart(24)}`);
  }
  await p.$disconnect();
})();
