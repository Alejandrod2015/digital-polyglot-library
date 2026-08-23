/**
 * Vuelca cada glosa COPIADA de un bundle hermano junto a la frase de ESTE
 * journey donde cae, para leerlas una a una.
 *
 * Existe porque `rebuildTapGlosses.ts` copia por PALABRA y no mira la oracion
 * (regla 3 de su cabecera). Su porton mecanico caza solo las copias que CITAN
 * su expresion; las que traen otro sentido sin marca ninguna (`caja` como "a
 * hand drum" cayendo sobre la caja del hielo) solo se ven leyendo. Y el
 * informe de rebuild dice "al dia" igual, porque comprueba que HAYA glosa, no
 * que sea la correcta.
 *
 * Uso: npx tsx scripts/reviewCopiedGlosses.ts spanish-traveler-spain-b1
 *      npx tsx scripts/reviewCopiedGlosses.ts spanish-traveler-spain-b1 --tsv
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import * as fs from "node:fs";
import * as path from "node:path";
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";

const DIR = path.resolve(__dirname, "../src/data/tapGlosses");
type Gloss = { g: string; t?: string };

function bundle(name: string) {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), "utf8")) as {
    slugs: string[];
    glosses: Record<string, Gloss>;
  };
}

async function run() {
  const name = process.argv[2];
  const tsv = process.argv.includes("--tsv");
  if (!name) {
    console.error("uso: reviewCopiedGlosses.ts <bundle> [--tsv]");
    process.exit(1);
  }
  const mine = bundle(name);
  const familia = name.split("-")[0];

  // Mismo pool hermano que usa el copiador: primera aparicion gana.
  const sib = new Map<string, string>();
  for (const f of fs.readdirSync(DIR)) {
    const other = f.replace(/\.json$/, "");
    if (!f.endsWith(".json") || other === name || !other.startsWith(`${familia}-`)) continue;
    for (const [k, v] of Object.entries(bundle(other).glosses)) if (!sib.has(k)) sib.set(k, v.g);
  }
  const copiadas = Object.keys(mine.glosses)
    .filter((k) => sib.get(k) === mine.glosses[k].g)
    .sort();

  const prisma = new PrismaClient();
  const stories = await prisma.$queryRawUnsafe<Array<{ slug: string; title: string | null; text: string | null }>>(
    `SELECT "slug","title","text" FROM "dp_journey_stories_v1" WHERE "slug" = ANY($1::text[]) ORDER BY "slug"`,
    mine.slugs
  );
  await prisma.$disconnect();

  const frases: Array<[string, string]> = [];
  for (const s of stories) {
    const plano = `${s.title ?? ""}. ${extractStoryPlainText(s.text ?? "")}`;
    for (const o of plano.split(/(?<=[.!?"”])\s+/)) frases.push([s.slug, o.trim()]);
  }

  let sinFrase = 0;
  for (const w of copiadas) {
    const re = new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu");
    const hit = frases.find(([, o]) => re.test(o));
    if (!hit) sinFrase += 1;
    const frase = hit ? hit[1] : "(NO APARECE)";
    console.log(tsv ? `${w}\t${mine.glosses[w].g}\t${frase}` : `${w} | ${mine.glosses[w].g} | ${frase}`);
  }
  console.error(`\n${copiadas.length} copiadas (${sinFrase} sin frase). Leelas contra su oracion.`);
}

run();
