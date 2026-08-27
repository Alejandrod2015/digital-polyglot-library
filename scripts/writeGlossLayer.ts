/**
 * Escribe la capa de contexto de UNA historia en la base.
 *
 *   npx tsx scripts/writeGlossLayer.ts <bundle> <slug> <trozos.json>
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
 * Sustituye al helper de JSON: desde el 2026-08-26 las glosas viven en
 * `dp_tap_glosses_v1` y escribir aqui se ve en produccion sin build.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
type Trozo = { es: string; en: string; gm?: string; g?: string; t?: string };

async function main() {
  const [bundle, slug, fichero] = process.argv.slice(2);
  if (!bundle || !slug || !fichero) {
    console.error("uso: writeGlossLayer.ts <bundle> <slug> <trozos.json>");
    process.exit(2);
  }
  const trozos = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, Trozo>;

  const global = await prisma.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
  if (!global) { console.error(`el bundle ${bundle} no existe en la base`); process.exit(1); }
  const plana = global.glosses as Record<string, { g: string; t: string }>;

  const faltan = Object.keys(trozos).filter((w) => !plana[w]);
  if (faltan.length) {
    console.error("no estan en la glosa global, no escribo:", faltan.join(", "));
    process.exit(1);
  }

  const fila = await prisma.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug } } });
  const capa = (fila?.glosses as Record<string, Record<string, unknown>>) ?? {};
  for (const [w, t] of Object.entries(trozos)) {
    const e = capa[w] ?? { g: plana[w].g, t: plana[w].t };
    e.g ??= plana[w].g;
    e.t ??= plana[w].t;
    e.c = { es: t.es, en: t.en };
    if (t.gm) e.gm = t.gm;
    if (t.g) e.g = t.g;
    if (t.t) e.t = t.t;
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
