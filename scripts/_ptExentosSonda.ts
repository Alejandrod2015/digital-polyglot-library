/**
 * SOLO LECTURA. Para cada bundle de portugues, cruza la fila de
 * scripts/tap-gloss-exempt.json con las historias del bundle en la base:
 *   - candidatos: palabras del cuerpo/titulo SIN glosa y SIN exencion,
 *     marcadas NUM (numeral), PROPIO (solo aparece con mayuscula) u OTRA;
 *   - rancias: entradas de la fila que ya no salen en ninguna historia;
 *   - conGlosa: entradas de la fila que tienen glosa (lint:gloss-variants).
 * No escribe nada.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";

const NUM = new Set(("zero um uma dois duas três tres quatro cinco seis sete oito nove dez onze doze treze catorze quatorze quinze dezesseis dezessete dezoito dezenove vinte trinta quarenta cinquenta sessenta setenta oitenta noventa cem cento duzentos duzentas trezentos trezentas quatrocentos quinhentos seiscentos setecentos oitocentos novecentos mil milhão meia primeiro primeira segundo segunda terceiro terceira quarto quarta quinto quinta sexto sexta sétimo sétima oitavo oitava nono nona décimo décima").split(" "));
const ART = ["a", "as", "o", "os", "um", "uma", "uns", "umas"];

const p = new PrismaClient();
(async () => {
  const ex = JSON.parse(fs.readFileSync("scripts/tap-gloss-exempt.json", "utf8")).bundles;
  const globales = await p.tapGlossSet.findMany({ where: { slug: "", bundle: { startsWith: "portuguese" } }, select: { bundle: true, slugs: true, glosses: true } });
  const out: Record<string, unknown> = {};
  for (const g of globales.sort((a, b) => a.bundle.localeCompare(b.bundle))) {
    const glos = new Set(Object.keys(g.glosses as object).map((k) => k.toLowerCase()));
    const st = await p.journeyStory.findMany({ where: { slug: { in: g.slugs } }, select: { slug: true, title: true, text: true, journeyId: true } });
    const corpus = st.map((s) => `${s.title ?? ""}\n${extractStoryPlainText(s.text ?? "")}`).join("\n");
    const toks = corpus.match(/\p{L}+(?:-\p{L}+)*/gu) ?? [];
    const lower = new Set<string>(), capOnly = new Map<string, boolean>();
    for (const t of toks) {
      const l = t.toLowerCase();
      lower.add(l);
      const cap = t[0] !== t[0].toLowerCase();
      capOnly.set(l, (capOnly.get(l) ?? true) && cap);
    }
    const fila = ex[g.bundle] ?? {};
    const exent = new Set<string>([...(fila.articles ?? []), ...(fila.numerals ?? []), ...(fila.characterNames ?? []), ...(fila.placeNames ?? [])].map((w: string) => w.toLowerCase()));
    const cand: string[] = [];
    for (const l of [...lower].sort()) {
      if (glos.has(l) || exent.has(l)) continue;
      cand.push(`${l}:${ART.includes(l) ? "ART" : NUM.has(l) ? "NUM" : capOnly.get(l) ? "PROPIO" : "OTRA"}`);
    }
    const rancias = [...exent].filter((w) => !lower.has(w));
    const conGlosa = [...exent].filter((w) => glos.has(w));
    const numsEnCorpus = [...lower].filter((l) => NUM.has(l)).sort();
    out[g.bundle] = { journeys: [...new Set(st.map((s) => s.journeyId))], historias: st.length, fila: Object.fromEntries(Object.entries(fila).map(([k, v]) => [k, (v as string[]).length])), candidatos: cand, rancias, conGlosa, numsEnCorpus, numsConGlosa: numsEnCorpus.filter((n) => glos.has(n)) };
  }
  console.log(JSON.stringify(out, null, 1));
})().finally(() => p.$disconnect());
