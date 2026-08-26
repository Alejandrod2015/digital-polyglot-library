/**
 * Mete una capa de contexto (`byStory`) en un bundle de tap-glosses y la
 * COMPRUEBA antes de escribir: cada clave tiene que ser un token real de la
 * historia, cada `c.es` un trozo literal de su texto, y cada `here` un indice
 * dentro de `rows`. Sin las tres cosas la tarjeta ensena algo que no esta ahi.
 *
 *   npx tsx scripts/_glossMerge.ts <bundle.json> <slug> <entradas.json> [--write]
 */
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

function tok(t: string) { const m = t.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/u); return m ? m[0] : ""; }

async function main() {
  const [bundlePath, slug, entriesPath] = process.argv.slice(2);
  const write = process.argv.includes("--write");
  const bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
  const entries = JSON.parse(fs.readFileSync(entriesPath, "utf8")) as Record<string, any>;

  const story = await prisma.journeyStory.findFirst({ where: { slug }, select: { text: true } });
  if (!story?.text) throw new Error(`sin texto: ${slug}`);
  const plain = story.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const tokens = new Set(plain.split(/\s+/).map(tok).filter(Boolean));

  const fallos: string[] = [];
  for (const [key, v] of Object.entries(entries)) {
    if (!tokens.has(key)) fallos.push(`"${key}": no es un token de la historia`);
    if (!v.g || !v.t) fallos.push(`"${key}": falta g o t`);
    if (v.c) {
      if (!v.c.es || !v.c.en) fallos.push(`"${key}": c incompleto`);
      else if (!plain.includes(v.c.es)) fallos.push(`"${key}": c.es no aparece literal -> "${v.c.es}"`);
      else if (!tok(v.c.es).length) fallos.push(`"${key}": c.es vacio`);
    }
    if (v.f) {
      if (!Array.isArray(v.f.rows) || v.f.rows.length === 0) fallos.push(`"${key}": f.rows vacio`);
      else if (typeof v.f.here !== "number" || v.f.here < 0 || v.f.here >= v.f.rows.length) {
        fallos.push(`"${key}": f.here fuera de rango (${v.f.here} de ${v.f.rows.length})`);
      }
      if (v.f.rows?.some((r: unknown[]) => !Array.isArray(r) || r.length !== 2)) fallos.push(`"${key}": f.rows mal formado`);
    }
    if (v.c && !v.c.es.toLowerCase().includes(key)) fallos.push(`"${key}": el trozo no contiene la palabra`);
  }
  if (fallos.length) {
    console.log(`FALLOS (${fallos.length}):`);
    fallos.forEach((f) => console.log("  -", f));
    if (write) throw new Error("no se escribe nada con fallos");
    return;
  }
  console.log(`OK: ${Object.keys(entries).length} entradas validas para ${slug}`);
  if (!write) { console.log("(dry run; con --write se escribe)"); return; }
  bundle.byStory = bundle.byStory ?? {};
  bundle.byStory[slug] = { ...(bundle.byStory[slug] ?? {}), ...entries };
  fs.writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 1)}\n`);
  console.log(`escrito en ${bundlePath}`);
}
main().finally(() => prisma.$disconnect());
