/** Segunda pasada: palabras que solo salen en el titulo NUEVO y no tenian fila
 *  propia en la historia, asi que la tarjeta repetia la definicion dos veces. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const BUNDLE = "german-friends-a2";
const TITULOS: Record<string, string> = {
  "bettruhe-in-der-probezeit": "Bed rest during the trial period",
  "ein-platz-mit-ihrem-namen": "A seat with her name on it",
  "zwei-strophen-im-stadion": "Two verses in the stadium",
  "brot-und-salz-fur-die-neue": "Bread and salt for the newcomer",
  "die-lampe-vom-sperrmull": "The lamp from the bulky waste",
  "heiser-nach-dem-derby": "Hoarse after the derby",
};
const aplica = process.argv.includes("--apply");
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: BUNDLE }, select: { id: true, slug: true, glosses: true } });
  const G = rows.find((r) => !r.slug)!.glosses as Record<string, any>;
  const st = await p.journeyStory.findMany({ where: { slug: { in: Object.keys(TITULOS) } }, select: { slug: true, title: true } });
  let n = 0;
  for (const s of st) {
    const fila = rows.find((r) => r.slug === s.slug)!;
    const gl = JSON.parse(JSON.stringify(fila.glosses)) as Record<string, any>;
    const palabras = (s.title.match(/[\p{L}]+/gu) ?? []).map((w) => w.toLowerCase());
    for (const w of new Set(palabras)) {
      if (gl[w] || !G[w]) continue;
      gl[w] = { c: { es: s.title, en: TITULOS[s.slug!] } };
      n++; console.log(`  + ${s.slug}|${w}`);
    }
    if (aplica) await p.tapGlossSet.update({ where: { id: fila.id }, data: { glosses: gl } });
  }
  console.log(`entradas de titulo anadidas: ${n}${aplica ? "" : " [seco]"}`);
  await p.$disconnect();
})();
