/**
 * SOLO LECTURA. Mide, historia por historia, que parte de las plazas de vocab
 * esta POR ENCIMA de A1/A2, o sea cuanto vocabulario propio del nivel trae de
 * verdad una historia. Se corre sobre:
 *   - las historias B1 de espanol ya escritas (referencia de como es un B1),
 *   - el Traveler PT-BR A1 publicado (patron oro de que NO es B1).
 * De ahi sale el suelo del check de PT b1, y no de una cifra inventada.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { isSpanishUpToLevel } from "../src/lib/cefr/spanishLevels";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";

const p = new PrismaClient();

async function main() {
  const js = await p.journey.findMany({
    where: { status: { not: "archived" } },
    select: { id: true, name: true, language: true, variant: true, levels: true },
  });

  console.log("journey                                   nivel  hist  plazas  fuera-de-A1A2  %");
  for (const j of js) {
    const nivel = j.levels[0] ?? "?";
    if (!["b1", "b2"].includes(nivel) && !(j.language === "portuguese" && nivel === "a1")) continue;
    const st = await p.journeyStory.findMany({
      where: { journeyId: j.id, NOT: { text: null } },
      select: { slug: true, vocab: true },
    });
    if (!st.length) continue;
    let tot = 0, arriba = 0;
    const ejemplos: string[] = [];
    for (const s of st) {
      for (const v of (s.vocab ?? []) as Array<{ word: string }>) {
        tot++;
        const w = String(v.word);
        const dentroA = j.language === "spanish"
          ? isSpanishUpToLevel(w, "a2")
          : isPortugueseA1A2(w);
        if (!dentroA) { arriba++; if (ejemplos.length < 12) ejemplos.push(w); }
      }
    }
    const etiqueta = `${j.name} ${j.language}/${j.variant}`.padEnd(41);
    console.log(`${etiqueta} ${nivel.padEnd(5)} ${String(st.length).padStart(4)} ${String(tot).padStart(7)} ${String(arriba).padStart(14)}  ${((100 * arriba) / (tot || 1)).toFixed(0)}%`);
    if (ejemplos.length) console.log(`      fuera de A1/A2: ${ejemplos.join(", ")}`);
    // Por historia: el suelo tiene que quedar por debajo de la PEOR historia de
    // la referencia, no por debajo de su media.
    const porHist = st.map((s) => {
      const vs = (s.vocab ?? []) as Array<{ word: string }>;
      const n = vs.filter((v) => !(j.language === "spanish"
        ? isSpanishUpToLevel(String(v.word), "a2")
        : isPortugueseA1A2(String(v.word)))).length;
      return { slug: s.slug, pct: (100 * n) / (vs.length || 1), n, tot: vs.length };
    }).sort((a, b) => a.pct - b.pct);
    console.log(`      por historia: min ${porHist[0].pct.toFixed(0)}% (${porHist[0].slug}, ${porHist[0].n}/${porHist[0].tot}) · p25 ${porHist[Math.floor(porHist.length * 0.25)].pct.toFixed(0)}% · mediana ${porHist[Math.floor(porHist.length / 2)].pct.toFixed(0)}% · max ${porHist[porHist.length - 1].pct.toFixed(0)}%`);
  }
}
main().catch((e) => console.error(String(e).slice(0, 800))).finally(() => p.$disconnect());
