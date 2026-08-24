/**
 * Vuelca cada glosa COPIADA de un bundle hermano junto a la frase de ESTE
 * journey donde cae, para leerlas una a una.
 *
 * Existe por la regla GLOSA EN CONTEXTO: la definicion sale de la frase de la
 * historia, no del diccionario. `rebuildTapGlosses.ts` copia por PALABRA y no
 * mira la oracion (regla 3 de su cabecera). Su porton mecanico caza solo las copias que CITAN
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
import { citaAjena } from "./rebuildTapGlosses";

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
  // --flags: solo las copias con una senal MECANICA de que traen la frase de
  // otro journey. No sustituye a la lectura; adelanta lo que si es automatico.
  const soloFlags = process.argv.includes("--flags");
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

  const corpus = stories
    .map((s) => `${s.title ?? ""} ${extractStoryPlainText(s.text ?? "")}`)
    .join(" ")
    .toLowerCase();

  /** Infinitivos de las cuatro lenguas romanicas y del aleman. Si la CLAVE no
   *  es un infinitivo y la glosa empieza por "to ", la copia esta glosando el
   *  lema y no la forma que el alumno esta tocando. */
  const ES_INFINITIVO =
    /((ar|er|ir)(me|te|le|lo|la|se|nos|les|los|las)?|are|ere|ire|(ar|er|ir)si|en|ern|eln)$/;
  /** "to the", "to him": la glosa empieza por "to" pero es una preposicion, no
   *  un infinitivo. Sin esto se marcan `al`, `le`, `zum`, `alla`. */
  const TO_PREPOSICION = /^to\s+(the|him|her|it|them|you|us|me)\b/i;

  /** Senales mecanicas de copia ajena. */
  function banderas(g: string, w: string): string[] {
    const b: string[] = [];
    if (/^to\s/i.test(g) && !TO_PREPOSICION.test(g) && !ES_INFINITIVO.test(w)) b.push("INFINITIVO");
    if (/\b(mexican|argentin\w*|colombian|chilean|peruvian|spain|spanish only|bavarian|austrian)\b/i.test(g))
      b.push("REGISTRO");
    if (citaAjena(g, corpus)) b.push("CITA-AJENA");
    // "here: X" dice "en ESTA oracion significa X", y la oracion es otra.
    if (/\bhere:/i.test(g)) b.push("HERE");
    // Parentesis descuadrados: la glosa se rompio al escribirla.
    if ((g.match(/\(/g) ?? []).length !== (g.match(/\)/g) ?? []).length) b.push("PARENTESIS");
    return b;
  }

  let sinFrase = 0;
  let marcadas = 0;
  for (const w of copiadas) {
    const re = new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu");
    const hit = frases.find(([, o]) => re.test(o));
    if (!hit) sinFrase += 1;
    const frase = hit ? hit[1] : "(NO APARECE)";
    const b = banderas(mine.glosses[w].g, w);
    if (b.length) marcadas += 1;
    if (soloFlags && !b.length) continue;
    const marca = b.length ? `[${b.join(",")}] ` : "";
    console.log(tsv ? `${marca}${w}\t${mine.glosses[w].g}\t${frase}` : `${marca}${w} | ${mine.glosses[w].g} | ${frase}`);
  }
  console.error(`\n${copiadas.length} copiadas, ${marcadas} con senal mecanica (${sinFrase} sin frase). Las demas solo se ven leyendo.`);
}

run();
