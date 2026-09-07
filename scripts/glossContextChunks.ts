/**
 * LA CAPA DE CONTEXTO, POR TROZOS COMPARTIDOS. Sirve para cualquier bundle.
 *
 * La tarjeta del lector enseña dos líneas: el sentido y el TROZO de la
 * historia donde la palabra cae. Sin el trozo, la tarjeta repite la definición
 * dos veces, que es el defecto que el usuario encontró tocando `carga` el
 * 2026-09-02 y que `lint:gloss-context` mide.
 *
 * POR QUÉ POR TROZO Y NO POR PALABRA. Un journey son unas 2.000 palabras
 * tocables, y escribirlas una a una es inviable. Pero el trozo SE COMPARTE:
 * "cheira a tinta fresca" vale para `tinta` y para `fresca`. Trabajando por
 * trozo, 21 historias son unos 800 trozos en vez de 2.000 pares, y cada trozo
 * se traduce UNA vez. Medido en el Traveler PT-BR A2: 2.076 entradas salieron
 * de 800 trozos.
 *
 * ── Uso ────────────────────────────────────────────────────────────────────
 *
 *   cuenta    <bundle>                 cobertura por historia
 *   trozos    <bundle> <slug> [--json] los trozos de una historia; --json da
 *                                      la plantilla con los huecos por traducir
 *   faltan    <bundle> <dir>           qué trozo falta por traducir, sin escribir
 *   escribe   <bundle> <dir> [--rehaz] escribe la capa de las historias que
 *                                      tengan fichero en <dir>/<slug>.json
 *   palabras  <bundle> <fichero>       las que no caen en ningún trozo, a mano:
 *                                      { slug: { palabra: {es, en} } }
 *   huerfanas <bundle> [--fix]         glosas cuya palabra ya no sale en el texto
 *   largos    <bundle>                 trozos cuyo inglés pasa del tope (PT+3)
 *
 * `--rehaz` BORRA los trozos que ya había antes de escribir. Hace falta cuando
 * el texto cambió y los trozos viejos apuntan a frases que ya no existen; sin
 * él, lo que ya tiene trozo se respeta (que es lo que quieres en un bundle con
 * capa escrita a mano).
 *
 * OJO con los huérfanos: al editar una historia DESPUÉS de escribir su capa, la
 * palabra desaparece del cuerpo y su trozo se queda apuntando a una frase que
 * ya no existe. `huerfanas --fix` limpia la base; si la palabra venía de un
 * fichero de `palabras`, hay que quitarla TAMBIÉN de ahí o la próxima pasada la
 * vuelve a escribir.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";

const TOCABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
/** Tope de palabras por trozo. `checkGlossVariants` pide que el inglés no pase
 *  de este número más tres, así que un trozo más largo arrastra siempre. */
const TOPE = 8;

const prisma = new PrismaClient();

/** Palabras que ABREN constituyente: preposiciones, relativos, subordinantes.
 *  Cortar justo delante de una deja las dos mitades enteras. */
const ARRANQUE = new Set([
  "a", "ante", "bajo", "con", "contra", "de", "desde", "durante", "en", "entre",
  "hacia", "hasta", "para", "por", "según", "sin", "sobre", "tras", "al", "del",
  "que", "quien", "quienes", "donde", "cuando", "como", "cuyo", "cuya", "si",
  "porque", "aunque", "mientras", "pero", "mas", "sino", "y", "e", "o", "u",
  "ao", "aos", "da", "das", "do", "dos", "na", "nas", "no", "nos", "pelo",
  "pela", "para", "com", "sem", "sob", "até", "desde", "entre", "onde",
  "quando", "porque", "embora", "enquanto", "mas", "que", "se",
]);

/** Palabras que no pueden QUEDARSE al final de un trozo: articulo, posesivo o
 *  preposición sueltos piden lo que viene detrás. "para buscar el" no es un
 *  trozo; es medio sintagma cortado. */
const COLGANTE = new Set([
  ...ARRANQUE,
  "el", "la", "los", "las", "un", "una", "unos", "unas", "lo",
  "mi", "mis", "tu", "tus", "su", "sus", "nuestro", "nuestra", "este", "esta",
  "ese", "esa", "aquel", "aquella", "esos", "esas", "estos", "estas",
  "o", "a", "os", "as", "um", "uma", "uns", "umas", "meu", "minha", "seu",
  "sua", "esse", "essa", "aquele", "aquela",
]);

const limpiaPalabra = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{M}]/gu, "");

/** El corte a mano: el más cercano al medio que abra constituyente y no deje
 *  colgando la pieza de la izquierda. Si no hay ninguno, al menos uno que no
 *  deje colgando; y solo si tampoco, por la mitad a ciegas. */
function parteAMano(ws: string[]): [string, string] {
  const medio = ws.length / 2;
  const puntua = (i: number) => Math.abs(i - medio);
  const noCuelga = (i: number) => !COLGANTE.has(limpiaPalabra(ws[i - 1]));
  const idx = [...ws.keys()].filter((i) => i > 0 && i < ws.length);
  const abre = idx.filter((i) => ARRANQUE.has(limpiaPalabra(ws[i])) && noCuelga(i));
  const sanos = idx.filter(noCuelga);
  const corte = (abre.length ? abre : sanos.length ? sanos : idx)
    .sort((a, b) => puntua(a) - puntua(b))[0] ?? Math.ceil(medio);
  return [ws.slice(0, corte).join(" "), ws.slice(corte).join(" ")];
}

/** Parte una pieza hasta que ninguna pase del tope, de separadores suaves a
 *  duros. El corte por palabras es la última salida y no hace falta si el
 *  texto está puntuado. */
function apretar(pieza: string, sep: RegExp[]): string[] {
  if ((pieza.match(TOCABLE) ?? []).length <= TOPE) return [pieza];
  for (let i = 0; i < sep.length; i++) {
    const partes = pieza.split(sep[i]).map((x) => x.trim()).filter(Boolean);
    if (partes.length > 1) return partes.flatMap((x) => apretar(x, sep.slice(i)));
  }
  const [izq, der] = parteAMano(pieza.split(/\s+/));
  return [...apretar(izq, sep), ...apretar(der, sep)];
}

/**
 * Los trozos de un texto. El punto de fin de frase puede venir seguido de
 * comilla de cierre: sin incluirla en el lookbehind, `lá de cima.” A água...`
 * se queda en una sola pieza de catorce palabras.
 */
export function trozosDe(texto: string): string[] {
  const out: string[] = [];
  for (const frase of texto.split(/(?<=[.!?…][”"]?)\s+|\n+/)) {
    const limpia = frase.replace(/[“”]/g, " ").replace(/\s+/g, " ").trim();
    if (!limpia) continue;
    const piezas = limpia
      .split(/\s*[,;:]\s*/)
      .flatMap((x) => apretar(x, [
        /\s*[.!?…]\s+/, /\s+\bmas\b\s+/, /\s+\bpero\b\s+/, /\s+\bporque\b\s+/,
        /\s+\bque\b\s+/, /\s+\be\b\s+/, /\s+\by\b\s+/,
      ]));
    for (const x of piezas) {
      const t = x.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}”]+$/gu, "").trim();
      if ((t.match(TOCABLE) ?? []).length >= 2) out.push(t);
    }
  }
  return out;
}

type Fila = { slug: string; slugs: string[]; glosses: Record<string, Record<string, unknown>> };

async function cargar(bundle: string) {
  const filas = (await prisma.tapGlossSet.findMany({
    where: { bundle }, select: { slug: true, slugs: true, glosses: true },
  })) as unknown as Fila[];
  if (!filas.length) throw new Error(`no hay bundle ${bundle}`);
  const global = filas.find((f) => !f.slug)?.glosses ?? {};
  const slugs = filas.find((f) => !f.slug)?.slugs ?? [];
  const historias = await prisma.journeyStory.findMany({
    where: { slug: { in: slugs.length ? slugs : filas.filter((f) => f.slug).map((f) => f.slug) } },
    select: { slug: true, title: true, text: true },
  });
  return { filas, global, historias };
}

/** Las palabras tocables de una historia que tienen glosa en el mapa global. */
function tocablesDe(texto: string, global: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  for (const m of texto.matchAll(TOCABLE)) {
    const w = m[0].toLowerCase();
    if (global[w]) out.add(w);
  }
  return out;
}

async function cuenta(bundle: string) {
  const { filas, global, historias } = await cargar(bundle);
  let conTrozo = 0, total = 0;
  for (const h of historias) {
    const propia = filas.find((f) => f.slug === h.slug)?.glosses ?? {};
    const tocables = tocablesDe(`${h.title}. ${h.text}`, global);
    const con = [...tocables].filter((w) => (propia[w] as { c?: unknown } | undefined)?.c).length;
    conTrozo += con; total += tocables.size;
    console.log(`${(h.slug ?? "").padEnd(32)} ${String(con).padStart(4)}/${String(tocables.size).padEnd(4)}`);
  }
  console.log(`\nTOTAL: ${conTrozo}/${total} con trozo · faltan ${total - conTrozo}`);
}

async function trozos(bundle: string, slug: string, json: boolean) {
  const { filas, global, historias } = await cargar(bundle);
  const h = historias.find((x) => x.slug === slug);
  if (!h) throw new Error(`no encuentro la historia ${slug} en ${bundle}`);
  const propia = filas.find((f) => f.slug === slug)?.glosses ?? {};
  const vistas = new Set<string>();
  const salida: Record<string, string> = {};
  for (const t of trozosDe(`${h.title}. ${h.text}`)) {
    const dentro = [...new Set((t.toLowerCase().match(TOCABLE) ?? []))]
      .filter((w) => global[w] && !vistas.has(w) && !(propia[w] as { c?: unknown } | undefined)?.c);
    dentro.forEach((w) => vistas.add(w));
    if (json) { if (dentro.length) salida[t] = ""; continue; }
    console.log(`\n${t}\n   ${dentro.join(" ") || "(ninguna nueva)"}`);
  }
  if (json) console.log(JSON.stringify(salida, null, 2));
}

/** Recorre las historias con fichero y devuelve, por historia, lo que se
 *  escribiria y lo que falta por traducir. */
function planDe(
  historias: Array<{ slug: string | null; title: string | null; text: string | null }>,
  filas: Fila[], global: Record<string, Record<string, unknown>>, dir: string, rehaz: boolean,
) {
  const plan: Array<{ slug: string; salida: Record<string, Record<string, unknown>>; n: number }> = [];
  const faltan: Array<{ slug: string; trozo: string }> = [];
  for (const h of historias) {
    const fichero = `${dir}/${h.slug}.json`;
    if (!fs.existsSync(fichero)) continue;
    const EN = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, string>;
    const previa = filas.find((f) => f.slug === h.slug)?.glosses ?? {};
    const salida: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of Object.entries(previa)) {
      if (!rehaz) { salida[k] = v; continue; }
      const { c: _viejo, ...resto } = v;
      salida[k] = resto;
    }
    const vistas = new Set<string>();
    let n = 0;
    for (const t of trozosDe(`${h.title}. ${h.text}`)) {
      const dentro = [...new Set((t.toLowerCase().match(TOCABLE) ?? []))]
        .filter((w) => global[w] && !vistas.has(w) && !(salida[w] as { c?: unknown } | undefined)?.c);
      if (!dentro.length) continue;
      if (!EN[t]) { faltan.push({ slug: h.slug!, trozo: t }); continue; }
      for (const w of dentro) {
        vistas.add(w);
        salida[w] = { ...(global[w] ?? {}), ...(salida[w] ?? {}), c: { es: t, en: EN[t] } };
        n++;
      }
    }
    plan.push({ slug: h.slug!, salida, n });
  }
  return { plan, faltan };
}

async function faltanCmd(bundle: string, dir: string) {
  const { filas, global, historias } = await cargar(bundle);
  const { faltan } = planDe(historias, filas, global, dir, false);
  let ultimo = "";
  for (const f of faltan) {
    if (f.slug !== ultimo) { console.log(`\n── ${f.slug}`); ultimo = f.slug; }
    console.log(`  ${JSON.stringify(f.trozo)}: "",`);
  }
  console.log(`\nTOTAL trozos por traducir: ${faltan.length}`);
}

async function escribe(bundle: string, dir: string, rehaz: boolean) {
  const { filas, global, historias } = await cargar(bundle);
  const { plan, faltan } = planDe(historias, filas, global, dir, rehaz);
  if (faltan.length) {
    console.error(`NADA ESCRITO. ${faltan.length} trozo(s) sin traducir; corre "faltan" para verlos.`);
    process.exit(1);
  }
  for (const { slug, salida } of plan)
    await prisma.tapGlossSet.upsert({
      where: { bundle_slug: { bundle, slug } },
      update: { glosses: salida as never },
      create: { bundle, slug, slugs: [], glosses: salida as never },
    });
  console.log(`${plan.length} historias · ${plan.reduce((a, b) => a + b.n, 0)} palabras con su trozo`);
}

async function palabras(bundle: string, fichero: string) {
  const datos = JSON.parse(fs.readFileSync(fichero, "utf8")) as
    Record<string, Record<string, { es: string; en: string }>>;
  const { filas, global } = await cargar(bundle);
  let n = 0;
  for (const [slug, ws] of Object.entries(datos)) {
    const previa = filas.find((f) => f.slug === slug)?.glosses ?? {};
    const salida = { ...previa };
    for (const [w, c] of Object.entries(ws)) {
      salida[w] = { ...(global[w] ?? {}), ...(previa[w] ?? {}), c };
      n++;
    }
    await prisma.tapGlossSet.update({
      where: { bundle_slug: { bundle, slug } }, data: { glosses: salida as never },
    });
  }
  console.log(`palabras con trozo escrito a mano: ${n}`);
}

/** ¿La clave de la glosa está escrita tal cual en el texto?
 *
 *  `TOCABLE` se lleva el guion dentro del token, así que "guarda-chuva" sale
 *  como una sola pieza y "guarda" parece huérfana estando ahí. Lo mismo con
 *  toda expresión de varias palabras: "em voz alta" nunca es un token. Sin
 *  esto, `--fix` borra glosas vivas (15 de las 28 que listaba en el B1). */
function saleLiteral(texto: string, clave: string): boolean {
  const esc = clave.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{M}])${esc}(?![\\p{L}\\p{M}])`, "u").test(texto);
}

async function huerfanas(bundle: string, fix: boolean) {
  const { filas, historias } = await cargar(bundle);
  let n = 0;
  for (const f of filas) {
    if (!f.slug) continue;
    const h = historias.find((x) => x.slug === f.slug);
    if (!h) continue;
    const texto = `${h.title}. ${h.text}`.toLowerCase();
    const enTexto = new Set([...texto.matchAll(TOCABLE)].map((m) => m[0]));
    const fuera = Object.keys(f.glosses).filter((w) => !enTexto.has(w) && !saleLiteral(texto, w));
    if (!fuera.length) continue;
    n += fuera.length;
    console.log(`${f.slug}: ${fuera.join(", ")}`);
    if (!fix) continue;
    for (const w of fuera) delete f.glosses[w];
    await prisma.tapGlossSet.update({
      where: { bundle_slug: { bundle, slug: f.slug } }, data: { glosses: f.glosses as never },
    });
  }
  console.log(`huerfanas: ${n}${fix ? " (borradas)" : " (solo listadas; usa --fix)"}`);
}

async function largos(bundle: string) {
  const { filas } = await cargar(bundle);
  const vistos = new Map<string, { slug: string; en: string; nEs: number; nEn: number }>();
  for (const f of filas) {
    if (!f.slug) continue;
    for (const v of Object.values(f.glosses) as Array<{ c?: { es?: string; en?: string } }>) {
      const es = v?.c?.es, en = v?.c?.en;
      if (!es || !en) continue;
      const nEs = es.split(/\s+/).length, nEn = en.split(/\s+/).length;
      if (nEn <= nEs + 3 || vistos.has(es)) continue;
      vistos.set(es, { slug: f.slug, en, nEs, nEn });
    }
  }
  for (const [es, v] of vistos)
    console.log(`${v.slug}\n  ${JSON.stringify(es)}: ${JSON.stringify(v.en)}   (${v.nEs} vs ${v.nEn})`);
  console.log(`\n${vistos.size} trozos distintos por encima del tope`);
}

if (require.main === module) {
  (async () => {
    const [cmd, bundle, arg] = process.argv.slice(2);
    const flag = (n: string) => process.argv.includes(`--${n}`);
    if (!cmd || !bundle) throw new Error("uso: glossContextChunks.ts <cuenta|trozos|faltan|escribe|palabras|huerfanas|largos> <bundle> [...]");
    if (cmd === "cuenta") await cuenta(bundle);
    else if (cmd === "trozos") await trozos(bundle, arg, flag("json"));
    else if (cmd === "faltan") await faltanCmd(bundle, arg);
    else if (cmd === "escribe") await escribe(bundle, arg, flag("rehaz"));
    else if (cmd === "palabras") await palabras(bundle, arg);
    else if (cmd === "huerfanas") await huerfanas(bundle, flag("fix"));
    else if (cmd === "largos") await largos(bundle);
    else throw new Error(`no conozco el comando "${cmd}"`);
  })().catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
