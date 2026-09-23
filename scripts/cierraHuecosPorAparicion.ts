/**
 * Cierra huecos de trozo por APARICION reusando los trozos YA TRADUCIDOS de la
 * misma historia.
 *
 * La capa nacio con un trozo por palabra, aunque la palabra saliera tres veces
 * (Ty 2026-09-15, Andre 2026-09-20). La tarjeta ya no ensena un trozo que no
 * cubre la posicion tocada, asi que cada aparicion sin trozo se queda muda.
 * Medido el 2026-09-21: 19 464 apariciones asi en los 27 bundles live.
 *
 * Pero los trozos SE COMPARTEN entre palabras de la misma historia (asi los
 * escribio `glossContextChunks.ts`: 21 historias son unos 800 trozos, no 2 000
 * pares). La aparicion muda de `dejo` suele caer dentro de un trozo que ya
 * esta traducido, escrito para `propina`. Esto lo aprovecha: para cada
 * aparicion sin cubrir busca, entre los trozos de ESA historia, uno que la
 * cubra, y lo anade a la lista de la palabra. No inventa ni traduce nada; lo
 * que no cae en ningun trozo existente se queda como esta y es autoria
 * pendiente de verdad.
 *
 * Es PURAMENTE ADITIVO: `c` no se toca nunca. La tarjeta elige por posicion
 * sobre `c` + `cs` (`chunkForTap`), asi que el orden dentro de la lista no
 * cambia lo que ve nadie, mientras que `c` SI lo leen las apps ya publicadas
 * y `checkGlossContextReal` mide justo ese campo. Lo nuevo se anade a `cs` en
 * orden de texto.
 *
 *   npx tsx scripts/cierraHuecosPorAparicion.ts <bundle> [--dry]
 *   npx tsx scripts/cierraHuecosPorAparicion.ts --live [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
import { chunkCoversTap, glossChunks, glossOccurrences, type GlossChunk } from "../src/lib/tapGlossChunk";

const prisma = new PrismaClient();
type Entrada = { c?: GlossChunk; cs?: GlossChunk[] } & Record<string, unknown>;

const SEP = String.fromCharCode(1);
const clave = (t: GlossChunk) => `${t.es}${SEP}${t.en}`;

/** Los trozos de una historia, de todas sus palabras, sin repetir. Un trozo de
 *  UNA sola palabra no entra: es la palabra sola repitiendo la definicion, que
 *  es justo lo que mide `checkGlossContextReal`, y no cuenta nada de contexto. */
function piscina(capa: Record<string, Entrada>): GlossChunk[] {
  const vistos = new Map<string, GlossChunk>();
  for (const entrada of Object.values(capa)) {
    for (const t of glossChunks(entrada)) {
      if (typeof t.en !== "string" || !t.en.trim()) continue;
      if (t.es.trim().split(/\s+/).length < 2) continue;
      if (!vistos.has(clave(t))) vistos.set(clave(t), { es: t.es, en: t.en });
    }
  }
  return [...vistos.values()];
}

/** Los trozos que faltan en la entrada, en orden de texto. Vacio si no falta
 *  ninguno o si no hay con que rellenarlos. */
function faltantes(
  palabra: string,
  texto: string,
  entrada: Entrada,
  pool: GlossChunk[]
): GlossChunk[] {
  const propios = glossChunks(entrada);
  if (!propios.length) return [];

  const nuevos: GlossChunk[] = [];
  const dentro = new Set(propios.map(clave));
  for (const o of glossOccurrences(palabra, texto)) {
    if (propios.some((t) => chunkCoversTap(t.es, texto, o.at, o.length))) continue;
    if (nuevos.some((t) => chunkCoversTap(t.es, texto, o.at, o.length))) continue;
    // El mas CORTO que cubra la aparicion: los trozos largos envuelven a los
    // cortos, y el corto es el que el lector lee de un vistazo.
    const candidato = pool
      .filter((t) => chunkCoversTap(t.es, texto, o.at, o.length))
      .sort((a, b) => a.es.length - b.es.length)[0];
    if (!candidato || dentro.has(clave(candidato))) continue;
    dentro.add(clave(candidato));
    nuevos.push({ es: candidato.es, en: candidato.en });
  }
  return nuevos;
}

async function bundlesLive(): Promise<string[]> {
  const rows = await prisma.tapGlossSet.findMany({
    where: { NOT: { slug: "" } },
    select: { bundle: true, slug: true },
  });
  const stories = await prisma.journeyStory.findMany({
    where: { slug: { in: rows.map((r) => r.slug) } },
    select: { slug: true, journey: { select: { status: true } } },
  });
  const estado = new Map(stories.map((s) => [s.slug, s.journey?.status]));
  const live = new Set<string>();
  for (const r of rows) if (estado.get(r.slug) === "active") live.add(r.bundle);
  return [...live].sort();
}

async function cierra(bundle: string, dry: boolean) {
  const filas = await prisma.tapGlossSet.findMany({
    where: { bundle, NOT: { slug: "" } },
    select: { slug: true, glosses: true },
  });
  const stories = await prisma.journeyStory.findMany({
    where: { slug: { in: filas.map((f) => f.slug) } },
    select: { slug: true, title: true, text: true },
  });
  const textos = new Map(stories.map((s) => [s.slug, `${s.title ?? ""}\n${extractStoryPlainText(s.text ?? "")}`]));

  let tocadas = 0;
  let historias = 0;
  for (const fila of filas) {
    const texto = textos.get(fila.slug);
    if (!texto) continue;
    const capa = (fila.glosses ?? {}) as Record<string, Entrada>;
    const pool = piscina(capa);
    let cambios = 0;
    for (const [palabra, entrada] of Object.entries(capa)) {
      if (typeof entrada?.c?.es !== "string") continue;
      const nuevos = faltantes(palabra, texto, entrada, pool);
      if (!nuevos.length) continue;
      entrada.cs = [...(entrada.cs ?? []), ...nuevos];
      cambios++;
    }
    if (!cambios) continue;
    tocadas += cambios;
    historias++;
    if (!dry) {
      await prisma.tapGlossSet.update({
        where: { bundle_slug: { bundle, slug: fila.slug } },
        data: { glosses: capa as never },
      });
    }
  }
  console.log(`${bundle}: ${tocadas} palabra(s) recolocadas en ${historias} historia(s)${dry ? " (dry)" : ""}`);
  return tocadas;
}

(async () => {
  const dry = process.argv.includes("--dry");
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const bundles = process.argv.includes("--live") ? await bundlesLive() : args;
  if (!bundles.length) {
    console.error("uso: cierraHuecosPorAparicion.ts <bundle> [--dry] | --live [--dry]");
    process.exitCode = 2;
    return;
  }
  let total = 0;
  for (const b of bundles) total += await cierra(b, dry);
  console.log(`total: ${total} palabra(s)${dry ? " (dry)" : ""}`);
})().finally(() => prisma.$disconnect());
