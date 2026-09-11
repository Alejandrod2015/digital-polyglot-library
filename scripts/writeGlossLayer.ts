/**
 * Escribe la capa de contexto de UNA historia en la base.
 *
 *   npx tsx scripts/writeGlossLayer.ts <bundle> <slug> <trozos.json> [--dry]
 *
 * `trozos.json`: { "palabra": { "es": "...", "en": "...", "gm"?, "g"?, "t"? }
 *
 * `g` y `t` solo se ponen cuando el bundle eligio el OTRO sentido: `cuenta` es
 * la cuenta del bar en el mapa global y aqui es "ella cuenta que viene de
 * lejos". La glosa global vale para todo el bundle y la historia manda sobre
 * ella, que es justo para lo que existe esta capa.
 *
 * Cada entrada de la historia PISA la glosa global del bundle entera, asi que
 * aqui se parte de la global (g y t intactos) y encima van el trozo, el genero
 * y las formas que ya hubiera. Lo que no se nombra, se queda como estaba: el
 * generador de conjugaciones ya paso por aqui.
 *
 * DE DONDE SALEN g Y t, en este orden: lo que diga el trozo, la entrada que ya
 * tenga la capa, la glosa global y, por ultimo, la plaza de vocab de la
 * historia cuyo `surface` o `word` sea la clave. Lo ultimo es para las
 * expresiones de varias palabras ("sala de espera", "por lo pronto"): el
 * lector nunca las toca sueltas, asi que no viven en la global, pero el panel
 * de vocab busca su trozo en la capa por esa clave entera (VocabPanel.tsx y
 * ReaderScreen.tsx, surface y luego word, en minusculas).
 *
 * UNA CLAVE MALA NO TIRA EL FICHERO. Hasta el 2026-09-11 una sola clave fuera
 * de la global rechazaba la historia entera con una linea en stderr, y dentro
 * de un bucle `for s in ...` esa linea se perdia: recortando el B1 de Espana,
 * tres capas se quedaron sin escribir y nadie lo vio. Ahora se escribe todo lo
 * que se puede resolver, lo que no se lista al final con su motivo, y el
 * proceso sale con 1. Nunca se pierde una entrada sin decirlo.
 *
 * Sustituye al helper de JSON: desde el 2026-08-26 las glosas viven en
 * `dp_tap_glosses_v1` y escribir aqui se ve en produccion sin build.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
type Trozo = { es?: string; en?: string; gm?: string; g?: string; t?: string };
type Vocab = { word?: string; surface?: string; definition?: string; type?: string };

const clave = (s: string) => s.normalize("NFC").trim().toLowerCase();

/** La glosa corta de una plaza de vocab: la definicion hasta el primer `;`
 *  ("Waiting room; where patients sit" -> "Waiting room"). */
const glosaDeVocab = (v: Vocab) => String(v.definition ?? "").split(";")[0].trim();

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const [bundle, slug, fichero] = args.filter((a) => !a.startsWith("--"));
  if (!bundle || !slug || !fichero) {
    console.error("uso: writeGlossLayer.ts <bundle> <slug> <trozos.json> [--dry]");
    process.exit(2);
  }
  const crudo = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, Trozo>;

  const global = await prisma.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
  if (!global) { console.error(`el bundle ${bundle} no existe en la base`); process.exit(1); }
  if (!global.slugs.includes(slug)) {
    console.error(`${slug} no es una historia del bundle ${bundle} (no esta en su lista de slugs)`);
    process.exit(1);
  }
  const plana = global.glosses as Record<string, { g: string; t: string }>;

  const historia = await prisma.journeyStory.findFirst({ where: { slug }, select: { vocab: true } });
  const vocab = new Map<string, Vocab>();
  for (const v of (historia?.vocab ?? []) as Vocab[]) {
    for (const k of [v.surface, v.word]) if (k && !vocab.has(clave(k))) vocab.set(clave(k), v);
  }

  const fila = await prisma.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug } } });
  const capa = (fila?.glosses as Record<string, Record<string, unknown>>) ?? {};

  const omitidas: string[] = [];
  let escritas = 0;
  for (const [original, t] of Object.entries(crudo)) {
    // El panel busca en minusculas; una clave con mayuscula no la encuentra nadie.
    const w = clave(original);
    if (!t?.es?.trim() || !t?.en?.trim()) {
      omitidas.push(`${original}: el trozo no trae "es" y "en"`);
      continue;
    }
    const previa = capa[w] as { g?: string; t?: string } | undefined;
    const v = vocab.get(w);
    const g = t.g ?? previa?.g ?? plana[w]?.g ?? (v ? glosaDeVocab(v) : undefined);
    const tipo = t.t ?? previa?.t ?? plana[w]?.t ?? v?.type;
    if (!g || !tipo) {
      omitidas.push(
        `${original}: sin glosa de donde partir (ni en la global, ni en la capa, ni es una plaza de vocab de ${slug}); ` +
          `si es de verdad una entrada nueva, pon "g" y "t" en el trozo`
      );
      continue;
    }
    const e = capa[w] ?? {};
    e.g = g;
    e.t = tipo;
    e.c = { es: t.es, en: t.en };
    if (t.gm) e.gm = t.gm;
    capa[w] = e;
    escritas++;
  }

  if (escritas && !dry) {
    await prisma.tapGlossSet.upsert({
      where: { bundle_slug: { bundle, slug } },
      create: { bundle, slug, language: global.language, variant: global.variant, slugs: [], glosses: capa as never },
      update: { glosses: capa as never },
    });
  }
  const con = Object.values(capa).filter((e) => (e as { c?: unknown }).c).length;
  console.log(
    `${dry ? "[dry] " : ""}${slug}: ${escritas} escritas de ${Object.keys(crudo).length}; ` +
      `la capa queda con ${con} trozos y ${Object.keys(capa).length} entradas`
  );
  await prisma.$disconnect();

  if (omitidas.length) {
    console.error(`\n!!! ${slug}: ${omitidas.length} clave(s) NO escritas${dry ? " (dry)" : ""}, el resto si:`);
    for (const o of omitidas) console.error(`    ${o}`);
    process.exit(1);
  }
}
main();
