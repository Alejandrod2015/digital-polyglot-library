/**
 * Techo de recirculación del Expat FR A0 SIN tocar los cuerpos.
 *
 * Igual que `_ladderCeiling.ts` (portugués), pero para francés y con el journey
 * por argumento. Para cada historia mira las palabras de su propio cuerpo que
 * podrían ser plaza de vocab (no funcionales, no enseñadas por otro journey del
 * idioma, no repetidas dentro del journey) y las ordena por en cuántos cuerpos
 * del journey aparecen. Quedarse con las 20 mejores da el techo.
 *
 *   npx tsx scripts/_ladderCeilingFR.ts <journeyId> <idioma>
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const FUNC = new Set((
  "le la les un une des du de et ou mais donc que qui quoi dont où à au aux en dans sur sous " +
  "pour par avec sans chez vers depuis pendant avant après elle il ils elles on je tu nous vous " +
  "se sa son ses leur leurs mon ma mes ton ta tes ce cet cette ces celui celle ceux " +
  "est sont était sera a ai as ont avons avez suis es sommes êtes pas ne plus très trop " +
  "bien aussi encore déjà toujours jamais ici là y en tout toute tous toutes même autre " +
  "quand comme si oui non peu beaucoup moins alors puis d l n s c j m t qu"
).split(/\s+/));

async function main() {
  const [journeyId, language] = process.argv.slice(2);
  const rows = await p.journeyStory.findMany({
    where: { journeyId, text: { not: null } },
    select: { slug: true, text: true, vocab: true },
  });
  const otras = await p.journeyStory.findMany({
    where: { journey: { language }, journeyId: { not: journeyId } },
    select: { vocab: true },
  });
  const fuera = new Set<string>();
  for (const r of otras) for (const v of ((r.vocab as Array<{ word?: unknown }>) ?? [])) {
    if (v?.word) fuera.add(String(v.word).toLowerCase());
  }
  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = rows.map((r) => new Set(tok(r.text!)));
  const enc = (w: string) => cuerpos.filter((c) => c.has(w)).length;

  // Lo que hay hoy: media de encuentros por plaza.
  let hoy = 0, plazas = 0;
  for (const r of rows) {
    for (const v of ((r.vocab as Array<{ word: string }>) ?? [])) {
      const head = (tok(v.word).sort((a, b) => b.length - a.length)[0]) ?? "";
      hoy += enc(head); plazas++;
    }
  }

  // Techo: las 20 mejores de cada cuerpo, sin repetir lema en el journey.
  const usados = new Set<string>();
  let techo = 0, plazasT = 0;
  const detalle: string[] = [];
  for (const [i, r] of rows.entries()) {
    const cand = [...new Set(tok(r.text!))]
      .filter((w) => w.length > 2 && !FUNC.has(w) && !fuera.has(w) && !usados.has(w))
      .sort((a, b) => enc(b) - enc(a))
      .slice(0, 20);
    cand.forEach((w) => usados.add(w));
    const media = cand.reduce((n, w) => n + enc(w), 0) / (cand.length || 1);
    techo += cand.reduce((n, w) => n + enc(w), 0); plazasT += cand.length;
    detalle.push(`  ${String(i + 1).padStart(2)} ${r.slug}: ${cand.length} plazas, media ${media.toFixed(2)} · mejores: ${cand.slice(0, 6).map((w) => `${w}(${enc(w)})`).join(" ")}`);
  }
  console.log(detalle.join("\n"));
  console.log(`\nHOY:   ${(hoy / plazas).toFixed(2)} encuentros por plaza (${plazas} plazas)`);
  console.log(`TECHO: ${(techo / plazasT).toFixed(2)} re-eligiendo el vocab sin tocar el texto (${plazasT} plazas)`);
  await p.$disconnect();
}
main();
