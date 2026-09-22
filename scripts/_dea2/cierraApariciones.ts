/**
 * Cada aparicion sin trozo recupera uno de los YA TRADUCIDOS de su historia.
 *
 * Los trozos se comparten entre las palabras de una historia, asi que la
 * aparicion muda de una palabra casi siempre cae dentro de un trozo escrito
 * para otra. Se le asigna el MAS CORTO que la contenga, sin traducir nada.
 *
 * Es puramente ADITIVO: `c` no se toca (es lo unico que leen las apps ya
 * publicadas), solo crece `cs`. Los trozos de UNA sola palabra no entran en
 * la piscina: son la palabra repitiendo su definicion y, por cortos, ganarian
 * siempre. Converge en dos pasadas, porque al escribir crece la piscina.
 *
 *   npx tsx scripts/_deA2/cierraApariciones.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { extractStoryPlainText } from "../../src/lib/storyPlainText";
import { chunkCoversTap, glossChunks, glossOccurrences, type GlossChunk } from "../../src/lib/tapGlossChunk";

const BUNDLE = "german-friends-a2";
const prisma = new PrismaClient();
const palabras = (s: string) => (s.match(/\p{L}[\p{L}\p{M}'-]*/gu) ?? []).length;

(async () => {
  const dry = process.argv.includes("--dry");
  const filas = await prisma.tapGlossSet.findMany({ where: { bundle: BUNDLE }, select: { slug:true, slugs:true, glosses:true } });
  const g0 = filas.find((f) => !f.slug)!;
  const hist = await prisma.journeyStory.findMany({ where: { slug: { in: g0.slugs } }, select: { slug:true, title:true, text:true } });
  let total = 0;
  for (const h of hist) {
    const fila = filas.find((f) => f.slug === h.slug);
    if (!fila) continue;
    const capa = fila.glosses as Record<string, { c?: GlossChunk; cs?: GlossChunk[] }>;
    const texto = `${h.title}\n${extractStoryPlainText(h.text ?? "")}`;
    const piscina: GlossChunk[] = [];
    const vistos = new Set<string>();
    for (const e of Object.values(capa)) for (const t of glossChunks(e)) {
      if (palabras(t.es) < 2 || vistos.has(t.es)) continue;
      vistos.add(t.es); piscina.push(t);
    }
    piscina.sort((a, b) => palabras(a.es) - palabras(b.es) || a.es.length - b.es.length);
    let n = 0;
    for (const [w, e] of Object.entries(capa)) {
      if (!e.c) continue;
      const tiene = glossChunks(e);
      const nuevos: GlossChunk[] = [];
      for (const oc of glossOccurrences(w, texto)) {
        if (tiene.some((t) => chunkCoversTap(t.es, texto, oc.at, oc.length))) continue;
        if (nuevos.some((t) => chunkCoversTap(t.es, texto, oc.at, oc.length))) continue;
        const cand = piscina.find((t) => chunkCoversTap(t.es, texto, oc.at, oc.length));
        if (cand) { nuevos.push(cand); n++; }
      }
      if (nuevos.length) e.cs = [...(e.cs ?? []), ...nuevos];
    }
    total += n;
    console.log(`${(h.slug ?? "").padEnd(32)} +${n}`);
    if (!dry && n) await prisma.tapGlossSet.update({ where: { bundle_slug: { bundle: BUNDLE, slug: h.slug! } }, data: { glosses: capa as never } });
  }
  console.log(`\n${dry ? "[dry] " : ""}${total} apariciones cubiertas reusando trozos ya traducidos`);
  await prisma.$disconnect();
})();
