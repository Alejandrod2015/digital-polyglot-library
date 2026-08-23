/**
 * Metricas de estilo del Traveler DE A0 mientras se reescribe: lo que los
 * gates NO miden (porcentaje de habla citada, formula de apertura, cierre a
 * solas) mas los dos limites A0 que si bloquean, para no ir al validador a
 * ciegas. Solo lectura sobre el data.json de trabajo.
 *
 *   npx tsx scripts/_deCheck.ts <data.json>
 */
import * as fs from "fs";
import { quotedStats } from "./_quotedRatio";

const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as {
  slug: string; title: string; text: string; vocab: { word: string; surface?: string }[];
}[];

const W = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
// El TIEMPO al principio es la formula prohibida: "am Morgen", "am Freitag",
// "heute", "frueh". Se busca solo en la primera frase.
const TIME = /\b(am (Morgen|Abend|Nachmittag|Vormittag|Mittag|Freitag|Samstag|Sonntag|Montag|Dienstag|Mittwoch|Donnerstag|ersten|letzten|naechsten|nächsten|zweiten|dritten)|heute|morgen frueh|früh|am Wochenende|um \d)/i;
const MOVE = /\b(geh(en|t)|fahr(en|t)|komm(en|t)|steig(en|t)|wander(n|t)|lauf(en|t)|reis(en|t)|nimm(t)?|nehmen|sitz(en|t)|steh(en|t))\b/i;

console.log("n |cit%|pal|med|max| 1as palabras                    | ultima frase");
let ins = 0, tot = 0, fuera = 0, tiempo = 0;
rows.forEach((r, i) => {
  const q = quotedStats(r.text);
  ins += q.inside; tot += q.total;
  if (q.pct < 25 || q.pct > 35) fuera++;
  const fr = r.text.split(/(?<=[.!?”])\s+/).map(W).filter(Boolean).sort((a, b) => a - b);
  const med = fr[Math.floor(fr.length / 2)];
  const max = fr[fr.length - 1];
  const first = r.text.split(/(?<=[.!?])\s/)[0] ?? "";
  const t = TIME.test(first);
  if (t) tiempo++;
  const last = r.text.trim().split(/(?<=[.!?”])\s+/).slice(-1)[0] ?? "";
  console.log(
    `${String(i + 1).padStart(2)}|${q.pct.toFixed(0).padStart(3)}%|${String(q.total).padStart(3)}|` +
    `${String(med).padStart(3)}|${String(max).padStart(3)}| ${(t ? "T " : "  ") + first.slice(0, 30).padEnd(30)} | ${last.slice(0, 46)}`
  );
});
console.log(`\nTOTAL ${(ins / tot * 100).toFixed(1)}% citado · ${fuera}/${rows.length} fuera de la banda 25-35 · ${tiempo}/${rows.length} abren con tiempo`);
