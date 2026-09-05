/**
 * Escanea TODAS las historias de journeys live+draft buscando el defecto
 * "cifra anunciada != cosas enumeradas": un numeral seguido de un sustantivo
 * y dos puntos, y detrás una lista cuyos elementos no cuadran con la cifra.
 *   "Nadias Sonntagsplan hat sieben Punkte: Supermarkt, Baumarkt, Apotheke,
 *    Bäcker, Bank."  -> dice 7, enumera 5.
 * Solo LECTURA. No escribe nada.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const NUMS: Record<string, number> = {
  // DE
  zwei: 2, drei: 3, vier: 4, "fünf": 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, "zwölf": 12,
  // ES
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  // IT
  due: 2, tre: 3, quattro: 4, cinque: 5, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12,
  // FR
  deux: 2, trois: 3, cinq: 5, sept: 7, huit: 8, dix: 10, onze: 11, douze: 12,
  // PT
  dois: 2, duas: 2, "três": 3, oito: 8, dez: 10, doze: 12,
};
for (let n = 2; n <= 12; n++) NUMS[String(n)] = n;

// Conectores de enumeración por idioma (todos juntos: el ruido lo filtro a ojo).
const CONJ = /\s+(?:und|oder|y|e|o|u|ed|et|ou|and|or|nor|noch)\s+/gi;

function splitItems(clause: string): string[] {
  return clause
    .replace(CONJ, ",")
    .split(/[,;]/)
    .map((x) => x.trim().replace(/^[-–—\s]+|[.!?…\s]+$/g, ""))
    .filter((x) => x.length > 0);
}

type Hit = {
  journey: string; status: string; lang: string; level: string;
  slug: string; title: string; stated: number; counted: number; sentence: string;
};

/** El escáner debe cazar el caso REAL que motivó todo esto. Si el self-test
 *  no pasa, un "0 sospechas" no significa nada. */
function selfTest(re: RegExp): void {
  const cases: Array<[string, number, number]> = [
    ["Nadias Sonntagsplan hat sieben Punkte: Supermarkt, Baumarkt, Apotheke, Bäcker, Bank.", 7, 5],
    ["El plan tiene cuatro paradas: la plaza, el mercado, la iglesia.", 4, 3],
    ["Nur ein Datum und drei Worte: Weitere Schritte folgen.", 0, 0],
  ];
  for (const [text, wantStated, wantCounted] of cases) {
    let found = false;
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
      const stated = NUMS[m[1].toLowerCase()];
      if (!stated) continue;
      const items = splitItems(m[3]);
      if (items.length < 2) continue;
      if (items.filter((x) => x.split(/\s+/).length <= 4).length < items.length) continue;
      if (items.length === stated) continue;
      found = true;
      const okc = stated === wantStated && items.length === wantCounted;
      console.log(`  selftest ${okc ? "OK  " : "MAL "} dice=${stated} enumera=${items.length} :: ${text.slice(0, 60)}`);
    }
    if (!found && wantStated !== 0) console.log(`  selftest MAL (no disparó) :: ${text.slice(0, 60)}`);
    if (!found && wantStated === 0) console.log(`  selftest OK   (no dispara, correcto) :: ${text.slice(0, 60)}`);
  }
}

async function run() {
  const prisma = new PrismaClient();
  const journeys = await prisma.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: {
      id: true, name: true, status: true, language: true, variant: true,
      stories: { select: { slug: true, title: true, text: true, synopsis: true, level: true } },
    },
  });

  const hits: Hit[] = [];
  const matches: Hit[] = []; // el patrón disparó Y la cifra cuadra (control de que el detector vive)
  let storiesScanned = 0;
  const numAlt = Object.keys(NUMS).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  // <numeral> <sustantivo(s)> : <lista>
  const re = new RegExp(`\\b(${numAlt})\\s+([\\p{L}]+(?:\\s+[\\p{L}]+)?)\\s*:\\s*([^.!?\\n]+)`, "giu");

  for (const j of journeys) {
    for (const s of j.stories) {
      storiesScanned++;
      const blob = `${s.text ?? ""}\n${s.synopsis ?? ""}`;
      for (const m of blob.matchAll(re)) {
        const stated = NUMS[m[1].toLowerCase()];
        if (!stated) continue;
        const items = splitItems(m[3]);
        // Solo cuenta como enumeración si hay separadores reales y los
        // elementos son cortos (1-4 palabras). Si no, es dos puntos de
        // explicación, no una lista.
        if (items.length < 2) continue;
        const short = items.filter((x) => x.split(/\s+/).length <= 4).length;
        if (short < items.length) continue;
        const row = {
          journey: j.name, status: j.status, lang: j.language, level: s.level ?? "?",
          slug: s.slug ?? "?", title: s.title ?? "?", stated, counted: items.length,
          sentence: m[0].trim().slice(0, 180),
        };
        if (items.length === stated) { matches.push(row); continue; }
        hits.push({
          journey: j.name, status: j.status, lang: j.language, level: s.level ?? "?",
          slug: s.slug ?? "?", title: s.title ?? "?", stated, counted: items.length,
          sentence: m[0].trim().slice(0, 180),
        });
      }
    }
  }

  // ── PASADA B: enumeración SIN dos puntos ────────────────────────────────
  // "Der Plan hat sieben Punkte. Supermarkt, Baumarkt, Apotheke."
  // Mucho más ruidosa que la pasada A; se revisa a mano.
  const reB = new RegExp(`\\b(${numAlt})\\s+([\\p{L}]+)\\b([^:]{0,40}?[.!?]\\s+)((?:[\\p{L}\\p{M}'’-]+(?:\\s+[\\p{L}\\p{M}'’-]+){0,3},\\s+){2,}[\\p{L}\\p{M}'’-]+(?:\\s+[\\p{L}\\p{M}'’-]+){0,3})[.!?]`, "giu");
  const hitsB: Hit[] = [];
  for (const j of journeys) {
    for (const s of j.stories) {
      const blob = `${s.text ?? ""}\n${s.synopsis ?? ""}`;
      for (const m of blob.matchAll(reB)) {
        const stated = NUMS[m[1].toLowerCase()];
        if (!stated) continue;
        const items = splitItems(m[4]);
        if (items.length < 3) continue;
        if (items.length === stated) continue;
        hitsB.push({
          journey: j.name, status: j.status, lang: j.language, level: s.level ?? "?",
          slug: s.slug ?? "?", title: s.title ?? "?", stated, counted: items.length,
          sentence: m[0].trim().replace(/\s+/g, " ").slice(0, 200),
        });
      }
    }
  }

  console.log("self-test del detector:");
  selfTest(re);
  console.log(`\njourneys live+draft: ${journeys.length} | historias escaneadas: ${storiesScanned}`);
  console.log(`enumeraciones detectadas que SÍ cuadran: ${matches.length}`);
  for (const h of matches) console.log(`   ok  [${h.status}] ${h.title} — dice ${h.stated}, enumera ${h.counted} :: "${h.sentence.slice(0, 90)}"`);
  console.log(`\nsospechas: ${hits.length}\n`);
  for (const h of hits) {
    console.log(`[${h.status}] ${h.journey} (${h.lang}) ${h.level} — ${h.title}`);
    console.log(`   slug: ${h.slug}`);
    console.log(`   dice ${h.stated}, enumera ${h.counted}`);
    console.log(`   "${h.sentence}"`);
    console.log();
  }
  console.log(`\n── PASADA B (enumeración sin dos puntos, revisar a mano): ${hitsB.length}\n`);
  for (const h of hitsB) {
    console.log(`[${h.status}] ${h.journey} (${h.lang}) ${h.level} — ${h.title}  [${h.slug}]`);
    console.log(`   dice ${h.stated}, enumera ${h.counted}  ::  "${h.sentence}"`);
    console.log();
  }
  await prisma.$disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });
