/**
 * Calibración del clasificador de utilidad contra TODO el vocabulario
 * existente (live + draft, nunca archived). SOLO LECTURA.
 *
 * Lo que hay que mirar: que NO marque anclas culturales. Un falso positivo
 * aquí bloquea a quien escribe, así que la barra es precisión, no cobertura.
 */
import { PrismaClient } from "../src/generated/prisma";
import { classifyVocabUtility } from "../src/lib/vocabUtility";
const prisma = new PrismaClient();

const ANCLAS = ["guelaguetza","tejate","híjole","weon","fome","achuntar","jalar","feierabendbier","schrebergarten","katerfrühstück","hormigas culonas","fernet"];

async function main() {
  const journeys = await prisma.journey.findMany({
    where: { status: { notIn: ["archived"] } },
    select: { name: true, language: true, status: true,
      stories: { select: { slug: true, vocab: true, status: true } } },
  });

  let total = 0;
  const flagged: Array<{ j: string; slug: string; word: string; def: string; reason: string }> = [];
  const anclasMarcadas: string[] = [];

  for (const j of journeys) {
    for (const s of j.stories) {
      const vocab = Array.isArray(s.vocab) ? (s.vocab as Array<Record<string, unknown>>) : [];
      for (const v of vocab) {
        total += 1;
        const entry = {
          word: String(v.word ?? ""),
          definition: String(v.definition ?? ""),
          type: String(v.type ?? ""),
          register: String(v.register ?? ""),
        };
        const r = classifyVocabUtility(entry);
        if (r.verdict === "lookup_only") {
          flagged.push({ j: `${j.name}/${j.language}`, slug: s.slug ?? "?", word: entry.word, def: entry.definition, reason: r.reason ?? "" });
          const lower = entry.word.toLowerCase();
          if (ANCLAS.some((a) => lower.includes(a))) anclasMarcadas.push(entry.word);
        }
      }
    }
  }

  console.log(`revisadas: ${total}`);
  console.log(`marcadas como solo-lookup: ${flagged.length} (${((flagged.length/total)*100).toFixed(1)}%)`);
  console.log(`ANCLAS CULTURALES marcadas por error: ${anclasMarcadas.length} ${anclasMarcadas.join(", ")}\n`);
  const byJourney = new Map<string, number>();
  for (const f of flagged) byJourney.set(f.j, (byJourney.get(f.j) ?? 0) + 1);
  console.log("por journey:");
  for (const [k, n] of [...byJourney].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(n).padStart(3)}  ${k}`);
  console.log("\ntodas las marcadas:");
  for (const f of flagged) console.log(`  ${f.word}\n      "${f.def}"\n      ${f.reason} · ${f.slug}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
