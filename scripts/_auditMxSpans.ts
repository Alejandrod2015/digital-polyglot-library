import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

const BOOK = "short-stories-in-mexican-spanish";
type V = { word: string; definition: string; type?: string };

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

async function main() {
  const stories = await p.catalogStory.findMany({
    where: { bookId: BOOK },
    orderBy: { position: "asc" },
    select: { position: true, slug: true, text: true, vocab: true },
  });

  let totalSpans = 0, totalOrphanSpans = 0, totalUnusedVocab = 0, totalCaseMismatch = 0;
  const orphanDetail: string[] = [];
  const unusedDetail: string[] = [];

  console.log("pos | spans | vocab | huérfanos | sin marcar | slug");
  for (const s of stories) {
    const vocab = (s.vocab ?? []) as unknown as V[];
    const vocabKeys = new Map(vocab.map((v) => [norm(v.word), v.word]));

    const spans = [...s.text.matchAll(/data-word="([^"]+)"/g)].map((m) => m[1]);
    totalSpans += spans.length;

    const orphans: string[] = [];
    const spanKeys = new Set<string>();
    for (const sp of spans) {
      const k = norm(sp);
      spanKeys.add(k);
      if (!vocabKeys.has(k)) orphans.push(sp);
      else if (vocabKeys.get(k) !== sp) totalCaseMismatch++;
    }
    const unused = vocab.filter((v) => !spanKeys.has(norm(v.word)));

    totalOrphanSpans += orphans.length;
    totalUnusedVocab += unused.length;

    console.log(
      `${String(s.position).padStart(3)} | ${String(spans.length).padStart(5)} | ${String(vocab.length).padStart(5)} | ${String(orphans.length).padStart(9)} | ${String(unused.length).padStart(10)} | ${s.slug}`
    );
    for (const o of orphans) orphanDetail.push(`[${s.position}] span "${o}" no existe en el glosario`);
    for (const u of unused) unusedDetail.push(`[${s.position}] glosario "${u.word}" (${u.definition}) nunca marcado en el texto`);
  }

  console.log(`\nTOTAL spans=${totalSpans} huérfanos=${totalOrphanSpans} vocab-sin-marcar=${totalUnusedVocab} desajuste-mayúsculas=${totalCaseMismatch}`);

  console.log(`\n=== SPANS HUÉRFANOS (tocar no muestra nada) : ${orphanDetail.length} ===`);
  orphanDetail.slice(0, 40).forEach((l) => console.log("  " + l));
  if (orphanDetail.length > 40) console.log(`  ... y ${orphanDetail.length - 40} más`);

  console.log(`\n=== VOCAB SIN MARCAR EN EL TEXTO : ${unusedDetail.length} ===`);
  unusedDetail.slice(0, 40).forEach((l) => console.log("  " + l));
  if (unusedDetail.length > 40) console.log(`  ... y ${unusedDetail.length - 40} más`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
