/**
 * Parte una historia en TROZOS y dice que palabras tocables caen en cada uno.
 *
 * El trozo es lo que la tarjeta del lector enseña debajo del sentido: el
 * pedazo minimo con sentido alrededor de la palabra, no la oracion entera.
 * En el bundle hermano del B1 un mismo trozo sirve a varias palabras
 * ("cheira a tinta fresca" vale para tinta y para fresca), y por eso se
 * trabaja por trozo y no por palabra: son unos veinte por historia en vez de
 * cien.
 *
 *   npx tsx scripts/_pta2Trozos.ts <slug>            imprime los trozos
 *   npx tsx scripts/_pta2Trozos.ts <slug> --json     plantilla para traducir
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const B = "portuguese-traveler-brazil-a2";
const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
const p = new PrismaClient();

/** Los trozos de un texto: oracion, y dentro de ella clausulas por coma o por
 *  "e" cuando la oracion es larga. Se quitan las comillas, que no son parte
 *  del trozo, y se descartan los pedazos de una sola palabra. */
const TOPE = 8;

/** Parte una pieza hasta que ninguna pase del tope, probando separadores de
 *  menos a mas invasivos. La ultima salida es cortar por palabras, que nunca
 *  hace falta si el texto esta puntuado, pero evita devolver un trozo largo. */
function apretar(pieza: string, sep: RegExp[]): string[] {
  if ((pieza.match(TOCABLE) ?? []).length <= TOPE) return [pieza];
  for (let i = 0; i < sep.length; i++) {
    const partes = pieza.split(sep[i]).map((x) => x.trim()).filter(Boolean);
    if (partes.length > 1) return partes.flatMap((x) => apretar(x, sep.slice(i)));
  }
  const ws = pieza.split(/\s+/);
  const mitad = Math.ceil(ws.length / 2);
  return [ws.slice(0, mitad).join(" "), ws.slice(mitad).join(" ")];
}

export function trozosDe(texto: string): string[] {
  const out: string[] = [];
  // El punto de fin de frase puede venir seguido de comilla de cierre: sin
  // incluirla en el lookbehind, "lá de cima.” A água..." se quedaba en una
  // sola pieza de catorce palabras.
  for (const frase of texto.split(/(?<=[.!?…][”"]?)\s+|\n+/)) {
    const limpia = frase.replace(/[“”]/g, " ").replace(/\s+/g, " ").trim();
    if (!limpia) continue;
    const piezas = limpia
      .split(/\s*[,;:]\s*/)
      .flatMap((x) => apretar(x, [/\s*[.!?…]\s+/, /\s+\bmas\b\s+/, /\s+\bporque\b\s+/, /\s+\bque\b\s+/, /\s+\be\b\s+/]));
    for (const x of piezas) {
      const t = x.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}”]+$/gu, "").trim();
      if ((t.match(TOCABLE) ?? []).length >= 2) out.push(t);
    }
  }
  return out;
}

// Solo corre cuando se invoca directamente: al importarlo desde otro
// script (_pta2PonContexto, _pta2Faltan) no debe tocar la base.
if (require.main === module) (async () => {
  const slug = process.argv[2];
  const json = process.argv.includes("--json");
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const global = (filas.find((f) => !f.slug)?.glosses ?? {}) as Record<string, { g?: string }>;
  const h = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
  if (!h) throw new Error(`no encuentro la historia ${slug}`);

  const trozos = trozosDe(`${h.title}. ${h.text}`);
  const vistas = new Set<string>();
  const salida: Record<string, string> = {};
  for (const t of trozos) {
    const dentro = [...new Set((t.toLowerCase().match(TOCABLE) ?? []))]
      .filter((w) => global[w] && !vistas.has(w));
    dentro.forEach((w) => vistas.add(w));
    if (json) { salida[t] = ""; continue; }
    console.log(`\n${t}`);
    console.log(`   ${dentro.join(" ") || "(ninguna nueva)"}`);
  }
  if (json) console.log(JSON.stringify(salida, null, 2));
  else console.log(`\n${trozos.length} trozos · ${vistas.size} palabras cubiertas`);
  await p.$disconnect();
})();
