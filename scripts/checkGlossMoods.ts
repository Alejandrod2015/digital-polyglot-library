/**
 * Lint de la capa GRAMATICAL de las glosas.
 *
 *   npm run lint:gloss-moods
 *
 * Dos cosas, y las dos bloquean:
 *
 *  1. COBERTURA. Vuelve a correr la deteccion de `buildGlossMoods.ts` sobre
 *     cada paquete de journey vivo (live + draft) y falla si sale una sola
 *     forma no indicativa sin bloque. Es el mismo codigo que escribe, no una
 *     copia: un lint que reimplementa la regla se desincroniza del generador y
 *     acaba dando verde sobre lo que el generador ya arregla.
 *  2. FORMA. Cada bloque con `mood` tiene que estar entero: `rows` con filas de
 *     dos, `here` dentro del rango, y los de `kind: "expand"` con su `head` de
 *     dos celdas y su enlace. Un bloque a medias pinta una tarjeta rota y
 *     ningun otro lint la ve.
 *
 * Ademas prohibe el signo igual, que es la regla de redaccion de las glosas
 * (`project_tap_glosses_contract`), y el guion largo.
 *
 * WHY: el 2026-09-03, en "Va a conseguir que esa persona se vaya", tocar
 * `vaya` devolvia "leaves, goes away (irse)". Una forma de subjuntivo servida
 * como entrada de diccionario en indicativo, sin nada que dijera que `se vaya`
 * no es `se va`. Habia 473 asi repartidas por 20 paquetes.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { moodsDeBundle, paquetesVivos } from "./buildGlossMoods";

const prisma = new PrismaClient();

const MODOS = new Set([
  "Subjunctive", "Past subjunctive", "Conditional", "Formal command",
  "Negative command", "Command", "Command + pronoun", "Verb + pronoun", "Konjunktiv II",
  // Futuro do subjuntivo. Existe en portugues y no en las otras tres lenguas
  // con tabla, que son de donde salio esta lista, asi que "que tiver" (A1 PT
  // Brazil, "o repelente mais forte que tiver") bloqueaba el push con un
  // bloque impecable: par de formas, conjugacion entera, fila encendida y
  // enlace. La lista no lo conocia; el modo es real.
  "Future subjunctive",
]);
/** Los idiomas con tablas de modo escritas. El resto se NOMBRA en la salida:
 *  callarse es como una capa entera se queda fuera sin que nadie lo note. */
const CON_TABLAS = ["spanish", "german", "italian", "portuguese"];

type Fallo = { bundle: string; slug: string; palabra: string; que: string };

function revisaForma(f: Record<string, unknown>): string | null {
  const mood = f.mood as string | undefined;
  if (!mood) return null;
  if (!MODOS.has(mood)) return `modo desconocido "${mood}"`;
  const rows = f.rows as string[][] | undefined;
  if (!Array.isArray(rows) || !rows.length) return "sin filas";
  if (rows.some((r) => !Array.isArray(r) || r.length !== 2 || !r[1])) return "una fila mal formada";
  const here = f.here as number | undefined;
  if (typeof here !== "number" || here < -1 || here >= rows.length) return `here fuera de rango (${here})`;
  const kind = f.kind as string | undefined;
  if (kind !== "line" && kind !== "expand") return `kind invalido (${kind})`;
  if (kind === "expand") {
    const head = f.head as string[][] | undefined;
    if (!Array.isArray(head) || head.length < 2) return "expand sin el par de cabecera";
    if (head.some((r) => !Array.isArray(r) || r.length !== 2 || !r[0] || !r[1])) return "cabecera mal formada";
    if (!f.link) return "expand sin enlace";
    if (here < 0) return "expand sin fila encendida";
  }
  if (kind === "line" && f.link) return "line con enlace, que no lleva a ningun sitio";
  const texto = JSON.stringify(f);
  if (texto.includes("=")) return "lleva un signo igual";
  // Escapado, no literal: el propio lint de guiones barre este arbol.
  if (/[\u2013\u2014]/.test(texto)) return "lleva un guion largo";
  return null;
}

async function main() {
  const bundles = await paquetesVivos(prisma);
  const fallos: Fallo[] = [];
  const sinTablas: string[] = [];
  let bloques = 0;

  for (const bundle of bundles) {
    const r = await moodsDeBundle(prisma, bundle, false);
    if (!r) continue;
    if (!CON_TABLAS.includes(r.idioma)) { sinTablas.push(`${bundle} (${r.idioma || "sin idioma"})`); continue; }
    for (const p of r.pendientes) {
      fallos.push({ bundle, slug: p.slug, palabra: p.palabra, que: `sin bloque, y es ${p.bloque.mood}` });
    }
    for (const capa of r.capas) {
      for (const [w, e] of Object.entries(capa.glosses as Record<string, { f?: Record<string, unknown> }>)) {
        if (!e?.f?.mood) continue;
        bloques++;
        const mal = revisaForma(e.f);
        if (mal) fallos.push({ bundle, slug: capa.slug, palabra: w, que: mal });
      }
    }
  }

  if (sinTablas.length) {
    console.log(`gloss-moods: sin tablas de modo escritas, no se comprueban: ${sinTablas.join(", ")}`);
  }
  if (!fallos.length) {
    console.log(`gloss-moods: limpio (${bundles.length} paquetes, ${bloques} bloques de modo)`);
    await prisma.$disconnect();
    return;
  }
  console.error(`\ngloss-moods: ${fallos.length} problemas\n`);
  for (const f of fallos.slice(0, 60)) {
    console.error(`  ${f.bundle} · ${f.slug} · ${f.palabra}: ${f.que}`);
  }
  if (fallos.length > 60) console.error(`  ... y ${fallos.length - 60} mas`);
  console.error("\nSe arregla corriendo:  npx tsx scripts/buildGlossMoods.ts --all\n");
  await prisma.$disconnect();
  process.exit(1);
}
main();
