/**
 * Los seis movimientos que deja el retitulado de dos historias del DE A2.
 * Tres cajones distintos y a proposito, porque no son el mismo arreglo:
 *
 *   REAPUNTAR  el trozo `c` apuntaba al titulo VIEJO y la palabra sigue viva.
 *              Se asciende a `c` el primer trozo vivo que ya estaba en `cs`,
 *              y `cs` se queda con los demas. No se inventa nada nuevo.
 *   ESCRIBIR   la palabra entro con el titulo nuevo y no tiene fila. Se crea
 *              con la glosa del mapa global y el trozo de su unica aparicion.
 *   BORRAR     la palabra ya no esta en el texto NI es plaza de vocab, o sea
 *              que no la alcanza ninguna de las dos llaves (el tap resuelve
 *              por superficie, VocabPanel por superficie Y por lema). Sin las
 *              dos comprobadas esto no se hace: mirar una sola llave se llevo
 *              57 glosas vivas el 2026-09-08.
 *
 *   npx tsx scripts/_deA2/cierraRetitulado.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { extractStoryPlainText } from "../../src/lib/storyPlainText";
import { chunkCoversTap } from "../../src/lib/tapGlossChunk";

const B = "german-friends-a2";
const p = new PrismaClient();

const REAPUNTAR: Array<[string, string]> = [
  ["drei-stunden-transporter", "transporter"],
  ["der-besen-im-blumenladen", "am"],
];
const ESCRIBIR: Array<[string, string, { es: string; en: string }]> = [
  ["der-besen-im-blumenladen", "im", { es: "Der Besen im Blumenladen", en: "The broom in the flower shop" }],
];
const BORRAR: Array<[string, string]> = [
  ["drei-stunden-transporter", "stunden"],
  ["der-besen-im-blumenladen", "freitag"],
  ["der-besen-im-blumenladen", "probearbeiten"],
];

(async () => {
  const dry = process.argv.includes("--dry");
  const global = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as Record<string, any>;
  const porSlug = new Map<string, Record<string, any>>();
  const textos = new Map<string, string>();
  const carga = async (slug: string) => {
    if (porSlug.has(slug)) return;
    const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    porSlug.set(slug, f!.glosses as Record<string, any>);
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { title: true, text: true } });
    textos.set(slug, `${s!.title}\n${extractStoryPlainText(s!.text ?? "")}`);
  };
  for (const [slug] of [...REAPUNTAR, ...BORRAR, ...ESCRIBIR.map(([s]) => [s] as [string])]) await carga(slug);

  const vivaEnTexto = (slug: string, w: string) =>
    new RegExp(`(?<![\\p{L}\\p{M}])${w}(?![\\p{L}\\p{M}])`, "iu").test(textos.get(slug)!);

  for (const [slug, w] of REAPUNTAR) {
    const g = porSlug.get(slug)!, e = g[w];
    if (!e) throw new Error(`${slug}/${w}: no existe`);
    const vivos = (e.cs ?? []).filter((t: any) => chunkCoversTap(t.es, textos.get(slug)!));
    if (!vivos.length) throw new Error(`${slug}/${w}: no hay trozo vivo que ascender`);
    e.c = vivos[0];
    const resto = vivos.slice(1);
    if (resto.length) e.cs = resto; else delete e.cs;
    console.log(`REAPUNTADA ${slug}/${w} -> "${e.c.es}"  (cs quedan ${resto.length})`);
  }

  for (const [slug, w, c] of ESCRIBIR) {
    const g = porSlug.get(slug)!;
    if (g[w]?.c) throw new Error(`${slug}/${w}: ya tiene trozo`);
    if (!chunkCoversTap(c.es, textos.get(slug)!)) throw new Error(`${slug}/${w}: "${c.es}" no es literal`);
    if (!global[w]) throw new Error(`${slug}/${w}: no esta en el mapa global`);
    g[w] = { ...(g[w] ?? {}), g: global[w].g, t: global[w].t, c };
    console.log(`ESCRITA    ${slug}/${w} -> "${c.es}"`);
  }

  for (const [slug, w] of BORRAR) {
    const g = porSlug.get(slug)!;
    if (!g[w]) throw new Error(`${slug}/${w}: no existe`);
    if (vivaEnTexto(slug, w)) throw new Error(`${slug}/${w}: SIGUE EN EL TEXTO, no se borra`);
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { vocab: true } });
    const esPlaza = ((s!.vocab as any[]) ?? []).some((v) =>
      String(v.word ?? "").toLowerCase().includes(w) || String(v.surface ?? "").toLowerCase() === w);
    if (esPlaza) throw new Error(`${slug}/${w}: SIGUE SIENDO PLAZA, no se borra`);
    delete g[w];
    console.log(`BORRADA    ${slug}/${w}  (ni en el texto ni plaza: ninguna de las dos llaves la alcanza)`);
  }

  if (dry) { console.log("\n[dry] nada escrito"); await p.$disconnect(); return; }
  for (const [slug, g] of porSlug)
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g as never } });
  console.log(`\n${porSlug.size} filas de historia actualizadas`);
  await p.$disconnect();
})();
