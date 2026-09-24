/** Cierra las apariciones sin trozo de este bundle escribiendo, por palabra, la
 *  LISTA completa de trozos en orden de texto: los que ya cubren se conservan y
 *  la aparicion muda recibe el fragmento de SU oracion, sin la etiqueta del
 *  hablante (este journey es de formato dialogo y "Nicolas: " no es contexto).
 *
 *    plantilla <fichero>   saca los fragmentos nuevos a traducir
 *    escribe   <fichero>   con el fichero traducido, escribe las listas
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
import { extractStoryPlainText } from "../../src/lib/storyPlainText";
import { uncoveredOccurrences } from "../../src/lib/tapGlossChunk";

const B = "spanish-conversations-latam-a0";
const prisma = new PrismaClient();
type Chunk = { es: string; en: string };
type Entrada = { c?: Chunk; cs?: Chunk[]; [k: string]: unknown };

/** La oracion donde cae `at`, sin la etiqueta del hablante y sin los signos de
 *  apertura, y partida por ? y ! ademas de por punto: "¿Tres años? Entonces no
 *  vuela de mi cuerda." son DOS contextos, no uno. */
function fragmento(texto: string, at: number): string {
  const ini = Math.max(texto.lastIndexOf("\n", at) + 1, 0);
  const finNl = texto.indexOf("\n", at);
  const linea = texto.slice(ini, finNl >= 0 ? finNl : texto.length);
  const rel = at - ini;
  const sinEtiqueta = linea.replace(/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+:\s*/, "");
  const quitado = linea.length - sinEtiqueta.length;
  let pos = rel - quitado;
  if (pos < 0) { pos = 0; }
  const trozos: Array<{ txt: string; ini: number }> = [];
  let cursor = 0;
  for (const parte of sinEtiqueta.split(/(?<=[.!?])\s+/)) {
    trozos.push({ txt: parte, ini: cursor });
    cursor += parte.length + 1;
  }
  const elegido = trozos.filter((t) => t.ini <= pos).pop() ?? trozos[0];
  const limpio = (x: string) => x.replace(/^[¿¡"“]+/, "").replace(/[.,;:!?"”]+$/, "").trim();
  // Si la ORACION es de una sola palabra ("Si.", "¿Casi?", "No."), el trozo
  // seria la palabra repitiendo su definicion. El contexto esta en el TURNO
  // entero, que aqui si tiene varias palabras ("Si. Y sin mayuscula."), asi
  // que se usa ese. Un turno que de verdad sea de una palabra no llega hasta
  // aqui: lo descarta el gate (turnoDeUnaPalabra, en tapGlossChunk.ts).
  if ((limpio(elegido.txt).match(/\p{L}+/gu) ?? []).length <= 1) return sinEtiqueta.trim();
  return limpio(elegido.txt);
}

async function cargar() {
  const filas = await prisma.tapGlossSet.findMany({ where: { bundle: B, NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  const stories = await prisma.journeyStory.findMany({
    where: { slug: { in: filas.map((f) => f.slug) } },
    select: { slug: true, title: true, text: true },
  });
  const texto = new Map(stories.map((s) => [s.slug, `${s.title ?? ""}\n${extractStoryPlainText(s.text ?? "")}`]));
  return { filas, texto };
}

async function plantilla(fichero: string) {
  const { filas, texto } = await cargar();
  const nuevos = new Set<string>();
  for (const fila of filas) {
    const t = texto.get(fila.slug); if (!t) continue;
    for (const [w, e] of Object.entries((fila.glosses ?? {}) as Record<string, Entrada>)) {
      if (typeof e?.c?.es !== "string") continue;
      for (const o of uncoveredOccurrences(w, t, e)) nuevos.add(fragmento(t, o.at));
    }
  }
  const previo: Record<string, string> = fs.existsSync(fichero) ? JSON.parse(fs.readFileSync(fichero, "utf8")) : {};
  const salida: Record<string, string> = {};
  for (const f of [...nuevos].sort()) salida[f] = previo[f] ?? "";
  fs.writeFileSync(fichero, JSON.stringify(salida, null, 1) + "\n");
  console.log(`${Object.keys(salida).length} fragmentos distintos · sin traducir: ${Object.values(salida).filter((v) => !v).length}`);
}

async function escribe(fichero: string) {
  const EN = JSON.parse(fs.readFileSync(fichero, "utf8")) as Record<string, string>;
  const { filas, texto } = await cargar();
  let palabras = 0, anadidos = 0;
  const sinTraducir = new Set<string>();
  for (const fila of filas) {
    const t = texto.get(fila.slug); if (!t) continue;
    const capa = (fila.glosses ?? {}) as Record<string, Entrada>;
    let tocada = false;
    for (const [w, e] of Object.entries(capa)) {
      if (typeof e?.c?.es !== "string") continue;
      const sin = uncoveredOccurrences(w, t, e);
      if (!sin.length) continue;
      const extra: Chunk[] = [];
      for (const o of sin) {
        const es = fragmento(t, o.at);
        const en = EN[es];
        if (!en) { sinTraducir.add(es); continue; }
        if (!t.includes(es)) { console.error(`NO literal en ${fila.slug}: "${es}"`); process.exit(1); }
        if (!extra.some((x) => x.es === es) && !(e.cs ?? []).some((x) => x.es === es) && e.c!.es !== es) extra.push({ es, en });
      }
      if (!extra.length) continue;
      e.cs = [...(e.cs ?? []), ...extra];
      palabras++; anadidos += extra.length; tocada = true;
    }
    if (!tocada) continue;
    await prisma.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: fila.slug } }, data: { glosses: capa as never } });
  }
  if (sinTraducir.size) { console.error(`${sinTraducir.size} fragmento(s) sin traducir, NO se escriben:`); [...sinTraducir].slice(0, 10).forEach((s) => console.error(`  "${s}"`)); }
  console.log(`${palabras} palabra(s), ${anadidos} trozo(s) anadidos`);
}

(async () => {
  const [cmd, fichero] = process.argv.slice(2);
  if (cmd === "plantilla") await plantilla(fichero);
  else if (cmd === "escribe") await escribe(fichero);
  else throw new Error("uso: cierraApariciones.ts <plantilla|escribe> <fichero>");
})().catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
