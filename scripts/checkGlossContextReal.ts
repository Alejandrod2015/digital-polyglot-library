/**
 * LINT: toda entrada de glosa con `c` tiene el contexto REAL de la historia,
 * no un contexto FALSO que pasa el check de presencia (`checkGlossContext.ts`)
 * sin serlo.
 *
 * WHY: `checkGlossContext.ts` solo comprueba que exista `c`; no comprueba que
 * ESE `c` sea de verdad el trozo traducido. Paso limpio dos veces con capas
 * falsas:
 *   - FR A1 Friends (Codex, 2026-09-13): 1.667 entradas con c.es = la palabra
 *     sola y c.en = la definicion cortada.
 *   - FR B1 Friends (2026-09-14, bundle french-friends-france-b1): 1.911 de
 *     1.933 entradas con c.en = la glosa de la palabra, no la traduccion del
 *     trozo citado.
 *
 * Los tres criterios (funcion pura en src/lib/glossContextReal.ts):
 *   a) c.es es una sola palabra y es la propia palabra tocada (salvo una
 *      replica real de una palabra, "Voilà.").
 *   b) c.en es la glosa g (propia o global) o la cubre en su mayor parte.
 *   c) c.es no aparece literal en el texto de la historia (los verbos
 *      separables citados con "…" se comprueban en orden, no pegados).
 *
 * La deuda de hoy NO bloquea todo el catalogo: se congela por bundle en
 * scripts/gloss-context-real-baseline.json como un CONJUNTO de entradas
 * (`slug|palabra`), no un numero, para que un hueco nuevo se distinga de uno
 * viejo (src/lib/glossContextBaseline.ts). Un bundle sin linea base sale a 0.
 * Ningun bundle se excluye de la linea base: quien cierre un journey a 0
 * simplemente aprieta el trinquete y su cupo baja, como cualquier otro.
 *
 * Run:  npm run lint:gloss-context-real                (todos, contra la linea base)
 *       npx tsx scripts/checkGlossContextReal.ts <bundle>   (uno, a cero)
 *       npm run lint:gloss-context-real -- --apretar         (baja la linea base)
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { evaluarEntradaGlossContext } from "../src/lib/glossContextReal";
import { apretarLineaBase, clavesDelBundle, compararConLineaBase, type LineaBaseGlossContext } from "../src/lib/glossContextBaseline";

const prisma = new PrismaClient();
const BASELINE = path.join(__dirname, "gloss-context-real-baseline.json");

async function medirBundle(bundle: string): Promise<{ malas: Set<string>; total: number; ejemplos: string[] }> {
  const rows = await prisma.tapGlossSet.findMany({
    where: { bundle }, select: { slug: true, glosses: true },
  });
  const global = (rows.find((r) => !r.slug)?.glosses ?? {}) as Record<string, { g?: string }>;
  const porHistoria = rows.filter((r) => r.slug) as Array<{ slug: string; glosses: unknown }>;
  const stories = await prisma.journeyStory.findMany({
    where: { slug: { in: porHistoria.map((r) => r.slug) } },
    select: { slug: true, title: true, text: true },
  });
  const textoPorSlug = new Map(stories.map((s) => [s.slug, `${s.title}. ${s.text}`]));

  const malas = new Set<string>();
  const ejemplos: string[] = [];
  let total = 0;
  for (const row of porHistoria) {
    const texto = textoPorSlug.get(row.slug);
    if (!texto) continue; // historia borrada/renombrada: fuera de alcance de este lint
    const glosses = (row.glosses ?? {}) as Record<string, { g?: string; c?: { es?: string; en?: string } }>;
    for (const [palabra, entrada] of Object.entries(glosses)) {
      if (!entrada?.c?.es || !entrada?.c?.en) continue; // sin contexto: lo caza checkGlossContext.ts
      total++;
      const g = entrada.g ?? global[palabra]?.g ?? "";
      const veredicto = evaluarEntradaGlossContext({ palabra, c: { es: entrada.c.es, en: entrada.c.en }, g, texto });
      if (!veredicto.ok) {
        const clave = `${row.slug}|${palabra}`;
        malas.add(clave);
        if (ejemplos.length < 6) {
          ejemplos.push(`  ${clave}: ${veredicto.motivo} (es="${entrada.c.es}" en="${entrada.c.en}")`);
        }
      }
    }
  }
  return { malas, total, ejemplos };
}

(async () => {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const apretar = process.argv.includes("--apretar");

  // Un bundle a mano: a cero, sin linea base (para trabajar una capa).
  if (args[0]) {
    const { malas, total, ejemplos } = await medirBundle(args[0]);
    if (malas.size === 0) {
      console.log(`gloss-context-real: limpio (${args[0]}: ${total} entradas con contexto, todas reales)`);
      return;
    }
    for (const e of ejemplos) console.error(e);
    console.error(`\ngloss-context-real: ${malas.size}/${total} entrada(s) con contexto falso en ${args[0]}`);
    process.exitCode = 1;
    return;
  }

  // Sin argumento: TODOS los bundles, contra la linea base.
  const bundles = (await prisma.tapGlossSet.findMany({
    select: { bundle: true }, distinct: ["bundle"],
  })).map((b) => b.bundle).sort();
  const baseline: LineaBaseGlossContext = fs.existsSync(BASELINE)
    ? JSON.parse(fs.readFileSync(BASELINE, "utf8"))
    : {};

  const medido: Record<string, Set<string>> = {};
  let nuevos = 0;
  let deudaVieja = 0;
  for (const b of bundles) {
    const { malas, ejemplos } = await medirBundle(b);
    medido[b] = malas;
    const { nuevos: nuevosDelBundle, viejos } = compararConLineaBase(b, malas, baseline);
    if (nuevosDelBundle.length) {
      nuevos += nuevosDelBundle.length;
      console.error(`${b}: ${nuevosDelBundle.length} hueco(s) NUEVOS (linea base ${clavesDelBundle(b, baseline).size})`);
      for (const e of ejemplos.slice(0, 6)) console.error(e);
    } else if (viejos.length > 0) {
      deudaVieja += viejos.length;
      console.log(`${b}: ${viejos.length} con contexto falso (deuda vieja, congelada)`);
    }
  }

  if (apretar) {
    const nueva = apretarLineaBase(medido, new Set());
    fs.writeFileSync(BASELINE, JSON.stringify(nueva, null, 2) + "\n");
    const total = Object.values(nueva).reduce((acc, arr) => acc + arr.length, 0);
    console.log(`gloss-context-real: linea base apretada (${Object.keys(nueva).length} bundles, ${total} entradas congeladas).`);
    return;
  }

  if (nuevos > 0) {
    console.error(`\ngloss-context-real: ${nuevos} hueco(s) NUEVOS por encima de la linea base.`);
    console.error("El contexto tiene que ser el trozo REAL de la historia, no la palabra sola ni la glosa repetida.");
    process.exitCode = 1;
    return;
  }
  console.log(
    `gloss-context-real: limpio (${bundles.length} bundles, sin huecos nuevos)` +
    (deudaVieja ? ` · deuda vieja ${deudaVieja} entradas, solo puede bajar` : "")
  );
})().finally(() => prisma.$disconnect());
