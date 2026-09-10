/**
 * Sonda gramatical: usos por cada 100 oraciones de cada rasgo, por journey o por tema.
 *
 *   npx tsx scripts/_gramProbe.ts <journeyId>[#tema] ... [--tokens]
 *
 * `--tokens` lista lo que casa en subjuntivo imperfecto, condicional y estilo
 * indirecto, que son las filas con mas riesgo de falso positivo. `mide(texto)` se
 * exporta para poder probar la sonda con frases de control sin tocar la base.
 *
 * LIMITES UNICODE (2026-09-10). La version anterior usaba `\b` sin la bandera `u`, y
 * en JavaScript `\b` trata la vocal acentuada como NO letra. Fallaba en las dos
 * direcciones: una palabra que acaba en `ó` no tenia limite detras (ningun preterito
 * en -ó contaba, "llegó" y "pidió" daban cero), y una `ó` en medio de palabra si lo
 * tenia ("canción", "cómo" contaban como preterito). Tampoco veia "así que" ni "aun
 * así". El Traveler spain A2 daba 12 preteritos por 100 oraciones y de verdad da 1.
 * La tabla "Criterios por nivel" del spec se midio con esta version.
 *
 * CONDICIONAL (2026-09-10). Contaba toda palabra en -ría: los imperfectos de verbos
 * con raiz en r ("quería", "aburría") y los sustantivos en -ería ("panadería",
 * "librería"). Ahora solo cuenta INFINITIVO + ía ("preguntaría") o una raiz
 * irregular ("tendría"). Un condicional de un verbo que no esta en las listas CEFR
 * se escapa: se prefiere eso a contar panaderias.
 *
 * ESTILO INDIRECTO. Exigia "dijo que" / "preguntó si" pegados y no contaba "me
 * preguntó ayer si volvería" ni "le había pedido que se quedara". Ahora admite hasta
 * tres palabras entre el verbo y el nexo, sin cruzar puntuacion (la coma de
 * "dijo Marcos, que..." suele abrir una relativa, no una indirecta).
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { isSpanishUpToLevel } from "../src/lib/cefr/spanishLevels";

const B = "(?<![\\p{L}])";
const E = "(?![\\p{L}])";
const re = (s: string) => new RegExp(s, "giu");

const RAIZ_IRREGULAR = new Set(["habr", "tendr", "podr", "sabr", "querr", "dir", "har", "pondr", "saldr", "vendr", "valdr", "cabr"]);
function esCondicional(w: string): boolean {
  const m = w.toLowerCase().match(/^(\p{L}+?)(íamos|íais|ías|ían|ía)$/u);
  if (!m) return false;
  const raiz = m[1];
  if (RAIZ_IRREGULAR.has(raiz)) return true;
  return /(ar|er|ir)$/.test(raiz) && isSpanishUpToLevel(raiz, "c1");
}

// Subjuntivo imperfecto (2026-09-10). La terminacion sola cazaba sustantivos
// (cuchara, cáscara, cámara), presentes de verbos en -arar (prepara), presentes de
// subjuntivo (pase, pasen), el adverbio "siquiera" y nombres propios (Javiera, seis
// veces en un C1). En -ara/-ase la raiz tiene que formar un verbo real: separ-ar si,
// cuch-ar no. En -iera/-yera basta la terminacion, salvo la lista y los nombres.
const NO_SUBJ = new Set(["para", "cara", "clara", "rara", "vara", "tara", "jara", "mara", "frase", "clase", "base", "fase",
  "cualquiera", "siquiera", "quienquiera", "dondequiera", "comoquiera", "fiera", "quiera", "quieran"]);
function esSubjImperfecto(w: string): boolean {
  const x = w.toLowerCase();
  if (NO_SUBJ.has(x)) return false;
  const m = x.match(/^(\p{L}+?)(áramos|árais|aras|aran|ara|ásemos|aseis|ases|asen|ase)$/u);
  if (!m) return true;
  const raiz = m[1];
  return raiz.length >= 3 && (isSpanishUpToLevel(`${raiz}ar`, "c1") || /(iz|ific)$/.test(raiz));
}

/**
 * BANDAS POR NIVEL (2026-09-10), en usos por 100 oraciones, medidas con ESTA sonda ya
 * arreglada. Solo B2 tiene banda: se anclo entre lo medido en los B1 (spain, latam) y
 * los C1 Friends publicados, auditado token a token. La lee scripts/cierraTema.ts y
 * bloquea el cierre de un tema fuera de banda. El preterito no lleva banda porque mide
 * el modo de narrar (Traveler en presente, Friends en pasado), no el nivel. Un nivel
 * sin fila aqui solo se informa.
 */
export const BANDA_NIVEL: Record<string, Record<string, [number, number]>> = {
  b2: { "subj. imperfecto": [3, 7], "condicional": [1, 5], "estilo indirecto": [1, 3] },
};

export const RASGOS: Array<{ n: string; r: RegExp; ok?: (w: string) => boolean }> = [
  { n: "pretérito", r: re(`${B}\\p{L}+(ó|aron|ieron)${E}|${B}(fue|fueron|tuvo|hizo|dijo|vino|dio|puso|quiso)${E}`) },
  // -ía fuera: "día", "policía", "panadería" la disparaban. Solo -aba/-aban
  // y la lista cerrada de irregulares frecuentes.
  { n: "imperfecto", r: re(`${B}\\p{L}+(aba|aban)${E}|${B}(era|eran|iba|iban|tenía|tenían|había|hacía|decía|veía|quería|podía|sabía|venía)${E}`) },
  { n: "condicional", r: re(`${B}\\p{L}+(ía|ías|íamos|íais|ían)${E}`), ok: esCondicional },
  { n: "subj. presente", r: re(`${B}(sea|sean|tenga|tengan|haya|hagan|pueda|puedan|venga|vengan|quiera|quieran|diga|vaya)${E}`) },
  // "para", "cara", "clara" y "vara" NO son subjuntivos; sin esta exclusión
  // el A0 mexicano marcaba 14 por cada 100 oraciones. "frase", "clase", "base",
  // "fase" y "cualquiera" se anadieron el 2026-09-10 por el mismo motivo, y
  // "quiera"/"quieran" porque son subjuntivo PRESENTE: la terminacion -iera(n)
  // los metia tambien aqui y contaban dos veces.
  { n: "subj. imperfecto", r: re(`${B}\\p{L}+(ara|aran|aras|áramos|iera|ieran|ieras|iéramos|yera|yeran|ase|asen|iese|iesen|yese|yesen)${E}`), ok: esSubjImperfecto },
  { n: "pasiva", r: re(`${B}(fue|fueron)\\s+\\p{L}+(ado|ada|ados|adas|ido|ida|idos|idas)${E}`) },
  { n: "estilo indirecto", r: re(`${B}(dijo|dijeron|contó|contaron|explicó|explicaron|preguntó|preguntaron|respondió|respondieron|avisó|avisaron|pidió|pidieron|dicho|contado|explicado|preguntado|respondido|avisado|pedido)(?:\\s+\\p{L}+){0,3}\\s+(que|si|qué|dónde|cuándo|cómo|cuánto|cuántos|quién)${E}`) },
  { n: "conectores", r: re(`${B}(sin embargo|en cambio|de hecho|aun así|por más que|mientras que|a pesar de|de modo que|así que)${E}`) },
];

export function mide(texto: string): { oraciones: number; usos: Record<string, number>; tokens: Record<string, string[]> } {
  const oraciones = texto.replace(/\n+/g, " ").split(/(?<=[.!?”"])\s+/).filter((f) => f.trim().length > 1).length;
  const usos: Record<string, number> = {};
  const tokens: Record<string, string[]> = {};
  // Nombre propio = palabra que sale con mayuscula en mitad de oracion en algun sitio
  // del texto. Solo filtra las filas con `ok` (terminaciones que un nombre imita).
  const propios = new Set(
    [...texto.matchAll(/(?<=[\p{Ll},;]\s+)(\p{Lu}\p{Ll}+)/gu)].map((x) => x[1].toLowerCase()),
  );
  for (const { n, r, ok } of RASGOS) {
    const m = (texto.match(r) ?? []).filter((w) => !ok || (!propios.has(w.toLowerCase()) && ok(w)));
    tokens[n] = m;
    usos[n] = oraciones ? Math.round((100 * m.length) / oraciones) : 0;
  }
  return { oraciones, usos, tokens };
}

async function main() {
  const p = new PrismaClient();
  const verTokens = process.argv.includes("--tokens");
  for (const arg of process.argv.slice(2).filter((a) => !a.startsWith("--"))) {
    const [id, tema] = arg.split("#");
    const j = await p.journey.findUnique({ where: { id }, select: { name: true, variant: true, levels: true } });
    const rows = await p.journeyStory.findMany({
      where: { journeyId: id, text: { not: null }, ...(tema ? { topic: tema } : {}) },
      select: { text: true },
    });
    const { oraciones, usos, tokens } = mide(rows.map((r) => r.text!).join("\n"));
    const out = RASGOS.map(({ n }) => `${n} ${usos[n]}`).join(" · ");
    console.log(`${(j?.levels ?? []).join("/")} ${j?.name} ${j?.variant}${tema ? ` #${tema}` : ""} (${oraciones} or.) -> ${out}`);
    if (verTokens) for (const n of ["subj. imperfecto", "condicional", "estilo indirecto"]) console.log(`   ${n}: ${tokens[n].join(" | ")}`);
  }
  await p.$disconnect();
}
if (/_gramProbe\.ts$/.test(process.argv[1] ?? "")) main();
