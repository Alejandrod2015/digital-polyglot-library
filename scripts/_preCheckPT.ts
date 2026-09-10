/** SOLO LECTURA. Todo lo que el validador canonico rechaza y se puede medir
 *  antes de llamarlo: largo, habla citada, parrafos, definiciones, superficies,
 *  reparto de vocab por parrafo, nivel y solape con lo ya ensenado. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
import { isPortugueseB1Lemma } from "../src/lib/cefr/portugueseB1";
const p = new PrismaClient();
const EX = ["cultural","realia","slang","colloquial","vulgar"];
const pal = (s: string) => (s.match(/[A-Za-zÀ-ÿ']+/g) ?? []).length;

(async () => {
  const d = JSON.parse(fs.readFileSync(process.env.F!, "utf8"));
  const previas = await p.journeyStory.findMany({
    where: { journey: { language: "portuguese" }, NOT: { text: null } },
    select: { slug: true, vocab: true, journeyId: true },
  });
  const ensenadas = new Map<string, string>();
  for (const s of previas) for (const v of (s.vocab ?? []) as Array<{ word: string }>) ensenadas.set(String(v.word).toLowerCase(), s.slug ?? "");
  const enEsteLote = new Map<string, string>();
  let malo = 0;
  for (const s of d) {
    const parr = String(s.text).split("\n\n");
    const w = pal(s.text);
    const q = (String(s.text).match(/“([^”]*)”/g) ?? []).reduce((a, m) => a + pal(m), 0);
    const cit = (100 * q) / w;
    const probl: string[] = [];
    if (w < 115 || w > 170) probl.push(`largo ${w} (115-170)`);
    if (cit < 25 || cit > 35) probl.push(`citado ${cit.toFixed(1)}% (25-35)`);
    if (parr.length < 4 || parr.length > 6) probl.push(`${parr.length} parrafos (4-6)`);
    const sy = pal(s.synopsis); if (sy < 45 || sy > 90) probl.push(`sinopsis ${sy}w (45-90)`);
    if (s.title.length > 26) probl.push(`titulo ${s.title.length}c (max 26)`);
    const cap = Math.floor(s.vocab.length * 0.3);
    parr.forEach((t: string, i: number) => {
      const n = s.vocab.filter((v: any) => t.includes(v.surface ?? v.word)).length;
      if (n > cap) probl.push(`¶${i + 1} con ${n} plazas (tope ${cap})`);
      if (n === 0) probl.push(`¶${i + 1} sin ninguna plaza`);
    });
    for (const v of s.vocab) {
      const sup = v.surface ?? v.word;
      if (!String(s.text).includes(sup)) probl.push(`"${sup}" no sale en el cuerpo`);
      const nd = v.definition.split(/\s+/).length;
      if (nd < 8 || nd > 14) probl.push(`def "${v.word}" ${nd}w`);
      const lw = String(v.word).toLowerCase();
      if (ensenadas.has(lw)) probl.push(`"${v.word}" ya lo ensena ${ensenadas.get(lw)}`);
      if (enEsteLote.has(lw) && enEsteLote.get(lw) !== s.slug) probl.push(`"${v.word}" repetido con ${enEsteLote.get(lw)}`);
      enEsteLote.set(lw, s.slug);
      if (v.type !== "expression" && !EX.includes(v.register ?? "") && !isPortugueseA1A2(v.word) && !isPortugueseB1Lemma(v.word))
        probl.push(`"${v.word}" fuera de B1`);
    }
    if (s.vocab.length < 20) probl.push(`${s.vocab.length} plazas (min 20)`);
    malo += probl.length;
    console.log(`${s.slug}: ${probl.length ? probl.join(" · ") : "LIMPIO"}`);
  }
  console.log(malo ? `\n${malo} problema(s)` : "\nlisto para saveStory");
})().catch((e) => console.error(String(e).slice(0, 400))).finally(() => p.$disconnect());
