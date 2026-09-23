/**
 * Escribe la capa de contexto de UNA historia en la base.
 *
 *   npx tsx scripts/writeGlossLayer.ts <bundle> <slug> <trozos.json>
 *
 * `trozos.json`: { "palabra": { "es": "...", "en": "...", "gm"?, "g"?, "t"?, "here"?, "nof"? }
 *
 * Una palabra que sale VARIAS veces en la historia lleva una LISTA, un trozo
 * por aparicion y en el orden del texto: el primero va a `c` (lo leen las apps
 * publicadas) y los demas a `cs`. Con un solo trozo, la tarjeta se lo callaba
 * en las otras apariciones y `checkGlossOccurrences.ts` las cuenta como hueco.
 * Todo trozo tiene que estar literal en el texto de la historia; si no, no se
 * escribe.
 *
 * `here` corrige la fila encendida de la tabla del generador, que elige la
 * PRIMERA fila con esa forma: `war` sale "ich war" en "Das war dumm", y
 * `sitzen` sale "wir" en "Alle sitzen". -1 es un infinitivo, ninguna fila.
 * `nof: true` quita la tabla cuando la palabra no es ese verbo aqui
 * (`sein` posesivo, `Tränen` sustantivo).
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
 * Sustituye al helper de JSON: desde el 2026-08-26 las glosas viven en
 * `dp_tap_glosses_v1` y escribir aqui se ve en produccion sin build.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
import { chunkCoversTap } from "../src/lib/tapGlossChunk";

const prisma = new PrismaClient();
type Trozo = { es: string; en: string; gm?: string; g?: string; t?: string; here?: number; nof?: boolean };
type Entrada = Trozo | Trozo[];
const primero = (e: Entrada): Trozo => (Array.isArray(e) ? e[0] : e);

async function main() {
  const [bundle, slug, fichero] = process.argv.slice(2);
  if (!bundle || !slug || !fichero) {
    console.error("uso: writeGlossLayer.ts <bundle> <slug> <trozos.json>");
    process.exit(2);
  }
  const trozos = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, Entrada>;
  for (const [w, e] of Object.entries(trozos)) {
    if (Array.isArray(e) && e.length === 0) { console.error(`${w}: lista vacia`); process.exit(1); }
  }

  const global = await prisma.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
  if (!global) { console.error(`el bundle ${bundle} no existe en la base`); process.exit(1); }
  const plana = global.glosses as Record<string, { g: string; t: string }>;

  const fila = await prisma.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug } } });
  const capa = (fila?.glosses as Record<string, Record<string, unknown>>) ?? {};
  // Una expresion de varias palabras ("vitel toné") vive solo en la capa de
  // la historia; vale si ya esta ahi aunque el mapa global no la tenga.
  const faltan = Object.keys(trozos).filter((w) => !plana[w] && !capa[w]);
  if (faltan.length) {
    console.error("no estan en la glosa global ni en la capa, no escribo:", faltan.join(", "));
    process.exit(1);
  }

  const story = await prisma.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
  if (!story) { console.error(`la historia ${slug} no existe en la base`); process.exit(1); }
  const texto = `${story.title}\n${extractStoryPlainText(story.text)}`;
  const noEstan = Object.entries(trozos).flatMap(([w, e]) =>
    (Array.isArray(e) ? e : [e]).filter((t) => !chunkCoversTap(t.es, texto)).map((t) => `${w}: "${t.es}"`)
  );
  if (noEstan.length) {
    console.error("trozos que no estan literales en la historia, no escribo:\n  " + noEstan.join("\n  "));
    process.exit(1);
  }

  for (const [w, entrada] of Object.entries(trozos)) {
    const t = primero(entrada);
    const e = capa[w] ?? { g: plana[w].g, t: plana[w].t };
    e.g ??= plana[w]?.g;
    e.t ??= plana[w]?.t;
    e.c = { es: t.es, en: t.en };
    if (Array.isArray(entrada)) {
      const resto = entrada.slice(1).map((x) => ({ es: x.es, en: x.en }));
      if (resto.length) e.cs = resto; else delete e.cs;
    }
    if (t.gm) e.gm = t.gm;
    if (t.g) e.g = t.g;
    if (t.t) e.t = t.t;
    if (t.nof) delete e.f;
    if (t.here !== undefined) {
      const f = e.f as { here: number } | undefined;
      if (!f) { console.error(`${w}: here sin tabla, no escribo`); process.exit(1); }
      f.here = t.here;
    }
    capa[w] = e;
  }
  await prisma.tapGlossSet.upsert({
    where: { bundle_slug: { bundle, slug } },
    create: { bundle, slug, language: global.language, variant: global.variant, slugs: [], glosses: capa as never },
    update: { glosses: capa as never },
  });
  const con = Object.values(capa).filter((e) => (e as { c?: unknown }).c).length;
  console.log(`${slug}: ${con} trozos, ${Object.keys(capa).length} entradas`);
  await prisma.$disconnect();
}
main();
