/** Genera el JSON para saveStory con las 5 palabras quitadas. SOLO LECTURA. */
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const prisma = new PrismaClient();

const QUITAR: Record<string, string[]> = {
  "duzen-auf-eigene-gefahr": ["der Dienstausweis"],
  "bewerbungsgespraech-mit-katze": ["der Gehaltsnachweis", "das Führungszeugnis"],
  "ein-antrag-auf-freizeit": ["der Mitgliedsantrag"],
  "zwei-stempel-bis-zur-existenz": ["die Anmeldebestätigung"],
};

async function main() {
  const out: unknown[] = [];
  for (const [slug, words] of Object.entries(QUITAR)) {
    const s = await prisma.journeyStory.findFirst({
      where: { slug, status: "published" },
      select: { title: true, slug: true, text: true, synopsis: true, arcType: true, vocab: true, level: true, topic: true, slotIndex: true },
    });
    if (!s) { console.log(`NO ENCONTRADA: ${slug}`); continue; }
    const vocab = (Array.isArray(s.vocab) ? s.vocab : []) as Array<Record<string, unknown>>;
    const drop = new Set(words.map((w) => w.toLowerCase()));
    const next = vocab.filter((v) => !drop.has(String(v.word ?? "").toLowerCase()));
    console.log(`${slug}: ${vocab.length} -> ${next.length}  (quitadas ${vocab.length - next.length}/${words.length})`);
    out.push({ title: s.title, slug: s.slug, text: s.text, synopsis: s.synopsis, arcType: s.arcType, vocab: next, level: s.level, topic: s.topic, slotIndex: s.slotIndex });
  }
  fs.writeFileSync("scripts/_expatFix.json", JSON.stringify(out, null, 2));
  console.log(`\nescrito scripts/_expatFix.json con ${out.length} historias`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
