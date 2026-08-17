/**
 * ¿Cuánto vocabulario curado NO se vuelve a ver nunca?
 *
 * Señal agnóstica del idioma: por cada entrada de vocab, cuántas veces aparece
 * su forma en TODOS los cuerpos publicados de ese idioma (live + draft, nunca
 * archived). Frecuencia 1 = solo existe en la historia que la enseña; el
 * usuario no la reencuentra jamás. No es un veredicto, es una señal.
 * SOLO LECTURA.
 */
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

const strip = (w: string) =>
  w.replace(/^(der|die|das|den|dem|el|la|los|las|un|una|il|lo|le|gli|i|un')\s+/i, "").trim();
const tok = (s: string) => s.toLowerCase().match(/\p{L}+/gu) ?? [];

async function main() {
  const journeys = await prisma.journey.findMany({
    where: { status: { notIn: ["archived"] } },
    select: { name: true, language: true, variant: true, status: true,
      stories: { where: { status: "published" }, select: { slug: true, text: true, vocab: true } } },
  });

  // Corpus por idioma
  const corpus = new Map<string, Map<string, number>>();
  for (const j of journeys) {
    const lang = (j.language ?? "?").toLowerCase();
    if (!corpus.has(lang)) corpus.set(lang, new Map());
    const freq = corpus.get(lang)!;
    for (const s of j.stories) {
      for (const t of tok(s.text ?? "")) freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }

  const byLang = new Map<string, { total: number; once: number; twice: number; more: number; ejemplos: string[] }>();
  for (const j of journeys) {
    const lang = (j.language ?? "?").toLowerCase();
    const freq = corpus.get(lang)!;
    if (!byLang.has(lang)) byLang.set(lang, { total: 0, once: 0, twice: 0, more: 0, ejemplos: [] });
    const acc = byLang.get(lang)!;
    for (const s of j.stories) {
      const vocab = Array.isArray(s.vocab) ? (s.vocab as Array<Record<string, unknown>>) : [];
      for (const v of vocab) {
        const word = strip(String(v.word ?? ""));
        const surface = strip(String(v.surface ?? ""));
        if (!word) continue;
        const keys = new Set([...tok(word).slice(0, 1), ...tok(surface).slice(0, 1)].filter(Boolean));
        let n = 0;
        for (const k of keys) n = Math.max(n, freq.get(k) ?? 0);
        acc.total += 1;
        if (n <= 1) { acc.once += 1; if (acc.ejemplos.length < 12) acc.ejemplos.push(`${word} (${s.slug})`); }
        else if (n === 2) acc.twice += 1;
        else acc.more += 1;
      }
    }
  }

  console.log("idioma        vocab   1 sola vez        2 veces     3 o mas");
  let gTotal = 0, gOnce = 0;
  for (const [lang, a] of [...byLang].sort((x, y) => y[1].total - x[1].total)) {
    gTotal += a.total; gOnce += a.once;
    const pct = ((a.once / a.total) * 100).toFixed(0);
    console.log(`${lang.padEnd(12)} ${String(a.total).padStart(5)}   ${String(a.once).padStart(5)} (${pct.padStart(2)}%)   ${String(a.twice).padStart(6)}   ${String(a.more).padStart(6)}`);
  }
  console.log(`\nTOTAL ${gTotal} entradas · ${gOnce} aparecen una sola vez (${((gOnce/gTotal)*100).toFixed(0)}%)\n`);
  for (const [lang, a] of byLang) {
    console.log(`\n${lang} · muestra de las que solo aparecen una vez:`);
    for (const e of a.ejemplos) console.log(`   ${e}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
