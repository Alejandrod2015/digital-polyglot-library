/**
 * Barrido del vocabulario aleman que NO reaparece en el corpus.
 *
 * Cruza dos senales que ya existen en el proyecto:
 *   - recurrencia real en TODOS los cuerpos publicados del idioma
 *   - el criterio de utilidad (src/lib/vocabUtility.ts)
 * y separa lo que es ancla cultural de lo que es etiqueta inerte.
 *
 * SOLO LECTURA. No escribe DB ni audio.
 */
import { PrismaClient } from "../src/generated/prisma";
import { classifyVocabUtility } from "../src/lib/vocabUtility";
import { isGermanA1A2 } from "../src/lib/cefr/germanA1A2";
const prisma = new PrismaClient();

const strip = (w: string) => w.replace(/^(der|die|das|den|dem)\s+/i, "").trim();
const tok = (s: string) => s.toLowerCase().match(/\p{L}+/gu) ?? [];

async function main() {
  const journeys = await prisma.journey.findMany({
    where: { status: { notIn: ["archived"] }, language: { equals: "german", mode: "insensitive" } },
    select: { name: true, variant: true, status: true,
      stories: { where: { status: "published" }, select: { slug: true, text: true, vocab: true } } },
  });

  const freq = new Map<string, number>();
  for (const j of journeys) for (const s of j.stories) for (const t of tok(s.text ?? "")) freq.set(t, (freq.get(t) ?? 0) + 1);

  type Row = { j: string; slug: string; word: string; def: string; type: string; f: number; inerte: boolean };
  const rows: Row[] = [];
  for (const j of journeys) {
    for (const s of j.stories) {
      const vocab = (Array.isArray(s.vocab) ? s.vocab : []) as Array<Record<string, unknown>>;
      for (const v of vocab) {
        const word = String(v.word ?? ""); if (!word) continue;
        const bare = strip(word);
        const key = tok(bare)[0] ?? "";
        const f = Math.max(freq.get(key) ?? 0, freq.get(tok(strip(String(v.surface ?? "")))[0] ?? "") ?? 0);
        if (f > 1) continue;
        const entry = { word, definition: String(v.definition ?? ""), type: String(v.type ?? ""), register: String(v.register ?? "") };
        rows.push({ j: `${j.name}/${j.variant}`, slug: s.slug ?? "?", word, def: entry.definition, type: entry.type,
          f, inerte: classifyVocabUtility(entry).verdict === "lookup_only" });
      }
    }
  }

  const total = journeys.flatMap((j) => j.stories).reduce((n, s) => n + (Array.isArray(s.vocab) ? s.vocab.length : 0), 0);
  console.log(`vocabulario aleman publicado: ${total}`);
  console.log(`no reaparece nunca (freq<=1): ${rows.length} (${((rows.length/total)*100).toFixed(0)}%)\n`);

  const byJ = new Map<string, Row[]>();
  for (const r of rows) { if (!byJ.has(r.j)) byJ.set(r.j, []); byJ.get(r.j)!.push(r); }
  for (const [j, rs] of byJ) console.log(`  ${j.padEnd(22)} ${rs.length}  ·  marcadas inertes por el criterio: ${rs.filter((r) => r.inerte).length}`);

  console.log(`\n── LOTE A: marcadas INERTES por el criterio (candidatas claras a quitar)`);
  for (const r of rows.filter((x) => x.inerte)) console.log(`   ${r.word.padEnd(28)} ${r.slug}`);

  const sust = rows.filter((r) => !r.inerte && r.type === "noun" && !isGermanA1A2(strip(r.word).toLowerCase()));
  console.log(`\n── LOTE B: sustantivos que no reaparecen y el criterio NO marca (${sust.length}); aqui esta tu juicio`);
  for (const r of sust.slice(0, 25)) console.log(`   ${r.word.padEnd(28)} ${r.def.slice(0, 46)}`);
  if (sust.length > 25) console.log(`   ... y ${sust.length - 25} mas`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
