/**
 * Mide la escalera de recirculacion con la MISMA formula del gate
 * (`journey-vocab-recirculation`, src/lib/validateJourneyStories.ts): por cada
 * plaza de vocab, en cuantas historias del journey aparece su clave.
 * Solo lectura.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const clave = (v: { word: string; surface?: string | null }) =>
  String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
(async () => {
  const js = await p.journey.findMany({ where: { status: { not: "archived" } } });
  const filas: Array<{ lvl: string; tag: string; media: number; unaVez: number; n: number }> = [];
  for (const j of js as never as Array<Record<string, unknown>>) {
    const rows = await p.journeyStory.findMany({ where: { journeyId: j.id as string }, select: { text: true, vocab: true } });
    const conTexto = rows.filter((r) => String(r.text ?? "").trim());
    if (conTexto.length < 7) continue;
    const cuerpos = conTexto.map((r) => new Set(tok(String(r.text ?? ""))));
    const enc: number[] = [];
    for (const r of conTexto) for (const v of ((r.vocab as Array<{word:string;surface?:string}> ?? [])))
      enc.push(cuerpos.filter((c) => c.has(clave(v))).length);
    if (!enc.length) continue;
    const media = enc.reduce((a, b) => a + b, 0) / enc.length;
    filas.push({
      lvl: ((j.levels as string[]) ?? []).join("+").toUpperCase(),
      tag: `${j.name}/${j.language}/${j.variant}`,
      media, unaVez: enc.filter((n) => n <= 1).length, n: enc.length,
    });
  }
  filas.sort((a, b) => a.lvl.localeCompare(b.lvl) || b.media - a.media);
  console.log("nivel  media  1-sola-vez  plazas  journey");
  for (const f of filas)
    console.log(`${f.lvl.padEnd(6)} ${f.media.toFixed(2).padStart(5)}  ${String(Math.round(100*f.unaVez/f.n)+"%").padStart(9)}  ${String(f.n).padStart(6)}  ${f.tag}`);
  const porNivel = new Map<string, number[]>();
  for (const f of filas) porNivel.set(f.lvl, [...(porNivel.get(f.lvl) ?? []), f.media]);
  console.log("\nrango por nivel:");
  for (const [lvl, ms] of [...porNivel].sort())
    console.log(`  ${lvl.padEnd(6)} ${Math.min(...ms).toFixed(2)} - ${Math.max(...ms).toFixed(2)}   (n=${ms.length})`);
})().finally(() => p.$disconnect());
