/**
 * Candidatas a "entender si, aprender no": entradas del vocab curado que son
 * jerga administrativa o compuestos muy largos. SOLO LECTURA, no escribe nada.
 * Comprueba ademas si cada una YA tiene glosa de quick lookup, que es lo que
 * decide si degradarla es gratis o exige escribir la glosa antes.
 */
import { PrismaClient } from "../src/generated/prisma";
import { getTapGlossesForSlug } from "../src/lib/tapGlosses";

const prisma = new PrismaClient();

const ADMIN = /(amt|behörde|antrag|bescheinig|nachweis|ausweis|vertrag|beitrag|anmeldung|zeugnis|titel|sachbearbeiter|verwaltung|gebühr|protokoll|pflicht|dienst|formular|escritura)/i;

async function main() {
  const journeys = await prisma.journey.findMany({
    where: { status: { notIn: ["archived"] } },
    select: { id: true, name: true, language: true, variant: true, status: true,
      stories: { where: { status: "published" }, select: { slug: true, title: true, vocab: true } } },
  });

  let total = 0;
  const rows: Array<{ j: string; slug: string; word: string; why: string; gloss: boolean }> = [];

  for (const j of journeys) {
    const label = `${j.name}/${j.language}/${j.variant} (${j.status})`;
    for (const s of j.stories) {
      const glosses = s.slug ? getTapGlossesForSlug(s.slug) : null;
      const vocab = Array.isArray(s.vocab) ? (s.vocab as Array<Record<string, unknown>>) : [];
      for (const v of vocab) {
        total += 1;
        const word = String(v.word ?? "").trim();
        if (!word) continue;
        const bare = word.replace(/^(der|die|das|el|la|los|las|il|lo|le)\s+/i, "");
        const isAdmin = ADMIN.test(bare);
        const isLong = /^[A-Za-zÀ-ÿß]+$/.test(bare) && bare.length >= 15;
        if (!isAdmin && !isLong) continue;
        const token = bare.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/u)?.[0] ?? "";
        rows.push({ j: label, slug: s.slug ?? "?", word, why: isAdmin ? (isLong ? "admin+largo" : "admin") : `largo ${bare.length}`, gloss: Boolean(token && glosses?.[token]) });
      }
    }
  }

  rows.sort((a, b) => a.j.localeCompare(b.j) || a.slug.localeCompare(b.slug));
  console.log(`vocab total revisado: ${total}`);
  console.log(`candidatas: ${rows.length}  ·  con glosa ya escrita: ${rows.filter(r => r.gloss).length}  ·  SIN glosa: ${rows.filter(r => !r.gloss).length}\n`);
  let cur = "";
  for (const r of rows) {
    if (r.j !== cur) { cur = r.j; console.log(`\n── ${cur}`); }
    console.log(`  ${r.gloss ? "✓" : "✗"} ${r.word}  ·  ${r.why}  ·  ${r.slug}`);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
