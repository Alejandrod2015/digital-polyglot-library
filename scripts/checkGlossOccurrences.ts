/**
 * LINT: toda aparicion de una palabra con trozo de contexto tiene SU trozo.
 *
 * WHY: la capa de contexto nacio con un trozo por palabra e historia, escrito
 * para una sola de sus apariciones. Al tocar otra, la tarjeta ensenaba la
 * frase de la primera: Ty (2026-09-15, `dejó` en los-aguanto-de-dos-en-dos) y
 * Andre (2026-09-20, "clicking three or four times until it finally works").
 * Medido ese dia: 18 836 de 95 010 trozos con una aparicion sin cubrir. La
 * tarjeta ya no ensena un trozo que no cubre la posicion tocada
 * (src/lib/tapGlossChunk.ts), asi que cada hueco de estos es una aparicion
 * que se queda sin frase. Se cierran escribiendo una LISTA de trozos en
 * `writeGlossLayer.ts`, uno por aparicion.
 *
 * Cuenta como hueco una aparicion de `palabra` en el texto (titulo y cuerpo)
 * que ningun trozo de la entrada (`c` y `cs`) cubre. Palabras sin `c` no
 * entran: sin capa no hay nada que confundir.
 *
 * La deuda de hoy se congela por bundle en
 * scripts/gloss-occurrences-baseline.json como CONJUNTO de `slug|palabra`
 * (src/lib/glossContextBaseline.ts): un hueco nuevo bloquea, uno viejo se ve
 * y solo puede bajar.
 *
 * Run:  npm run lint:gloss-occurrences                       (todos, contra la linea base)
 *       npx tsx scripts/checkGlossOccurrences.ts <bundle>    (uno, a cero)
 *       npx tsx scripts/checkGlossOccurrences.ts <bundle> --lista  (cada hueco, con su frase)
 *       npm run lint:gloss-occurrences -- --apretar           (baja la linea base)
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
import { uncoveredOccurrences, type GlossChunk } from "../src/lib/tapGlossChunk";
import { apretarLineaBase, clavesDelBundle, compararConLineaBase, type LineaBaseGlossContext } from "../src/lib/glossContextBaseline";

const prisma = new PrismaClient();
const BASELINE = path.join(__dirname, "gloss-occurrences-baseline.json");

type Entrada = { c?: GlossChunk; cs?: GlossChunk[] };

function frase(texto: string, at: number): string {
  const ini = Math.max(texto.lastIndexOf("\n", at), texto.lastIndexOf(". ", at) + 1, 0);
  const finCandidatos = [texto.indexOf("\n", at), texto.indexOf(". ", at)].filter((i) => i >= 0);
  const fin = finCandidatos.length ? Math.min(...finCandidatos) + 1 : texto.length;
  return texto.slice(ini, fin).trim();
}

async function medirBundle(bundle: string, lista = false): Promise<{ malas: Set<string>; total: number; huecos: number; ejemplos: string[] }> {
  const rows = await prisma.tapGlossSet.findMany({ where: { bundle, NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  const stories = await prisma.journeyStory.findMany({
    where: { slug: { in: rows.map((r) => r.slug) } },
    select: { slug: true, title: true, text: true },
  });
  const textoPorSlug = new Map(stories.map((s) => [s.slug, `${s.title ?? ""}\n${extractStoryPlainText(s.text ?? "")}`]));

  const malas = new Set<string>();
  const ejemplos: string[] = [];
  let total = 0;
  let huecos = 0;
  for (const row of rows) {
    const texto = textoPorSlug.get(row.slug);
    if (!texto) continue;
    const glosses = (row.glosses ?? {}) as Record<string, Entrada>;
    for (const [palabra, entrada] of Object.entries(glosses)) {
      if (typeof entrada?.c?.es !== "string") continue;
      total++;
      const sin = uncoveredOccurrences(palabra, texto, entrada);
      if (!sin.length) continue;
      huecos += sin.length;
      malas.add(`${row.slug}|${palabra}`);
      if (lista) {
        for (const o of sin) ejemplos.push(`  ${row.slug} | ${palabra} | ${frase(texto, o.at)}`);
      } else if (ejemplos.length < 6) {
        ejemplos.push(`  ${row.slug}|${palabra}: ${sin.length} aparicion(es) sin trozo, p. ej. "${frase(texto, sin[0].at).slice(0, 80)}"`);
      }
    }
  }
  return { malas, total, huecos, ejemplos };
}

(async () => {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const apretar = process.argv.includes("--apretar");
  const lista = process.argv.includes("--lista");

  if (args[0]) {
    const { malas, total, huecos, ejemplos } = await medirBundle(args[0], lista);
    if (malas.size === 0) {
      console.log(`gloss-occurrences: limpio (${args[0]}: ${total} entradas con trozo, todas las apariciones cubiertas)`);
      return;
    }
    for (const e of ejemplos) console.error(e);
    console.error(`\ngloss-occurrences: ${malas.size}/${total} palabra(s) con apariciones sin trozo (${huecos} apariciones) en ${args[0]}`);
    process.exitCode = 1;
    return;
  }

  const bundles = (await prisma.tapGlossSet.findMany({ select: { bundle: true }, distinct: ["bundle"] }))
    .map((b) => b.bundle).sort();
  const baseline: LineaBaseGlossContext = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : {};

  const medido: Record<string, Set<string>> = {};
  let nuevos = 0;
  let deudaVieja = 0;
  for (const b of bundles) {
    const { malas, ejemplos } = await medirBundle(b);
    medido[b] = malas;
    const { nuevos: nuevosDelBundle, viejos } = compararConLineaBase(b, malas, baseline);
    if (nuevosDelBundle.length) {
      nuevos += nuevosDelBundle.length;
      console.error(`${b}: ${nuevosDelBundle.length} palabra(s) NUEVAS con apariciones sin trozo (linea base ${clavesDelBundle(b, baseline).size})`);
      for (const e of ejemplos.slice(0, 6)) console.error(e);
    } else if (viejos.length > 0) {
      deudaVieja += viejos.length;
      console.log(`${b}: ${viejos.length} palabra(s) con apariciones sin trozo (deuda vieja, congelada)`);
    }
  }

  if (apretar) {
    const nueva = apretarLineaBase(medido, new Set());
    fs.writeFileSync(BASELINE, JSON.stringify(nueva, null, 2) + "\n");
    const total = Object.values(nueva).reduce((acc, arr) => acc + arr.length, 0);
    console.log(`gloss-occurrences: linea base apretada (${Object.keys(nueva).length} bundles, ${total} palabras congeladas).`);
    return;
  }

  if (nuevos > 0) {
    console.error(`\ngloss-occurrences: ${nuevos} palabra(s) NUEVAS con apariciones sin trozo por encima de la linea base.`);
    console.error("Cada aparicion de una palabra con contexto lleva su trozo: lista de trozos en writeGlossLayer.ts.");
    process.exitCode = 1;
    return;
  }
  console.log(
    `gloss-occurrences: limpio (${bundles.length} bundles, sin huecos nuevos)` +
    (deudaVieja ? ` · deuda vieja ${deudaVieja} palabras, solo puede bajar` : "")
  );
})().finally(() => prisma.$disconnect());
