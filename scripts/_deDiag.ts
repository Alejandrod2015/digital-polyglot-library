/**
 * Diagnostico de los tres checks que fallan al reescribir: ancla sensorial,
 * vocab por parrafo AUTORADO (el cluster salta con un ¶ de 6+ y otro de 0) y
 * longitud de frase con el MISMO cortador que usa el validador, que no es el
 * ingenuo: una frase que acaba en `.”` no corta ahi.
 *
 *   npx tsx scripts/_deDiag.ts <data.json>
 */
import * as fs from "fs";

const SENSES: Record<string, RegExp> = {
  smell: /\b(Geruch|riecht|Duft)\b/i,
  light: /\b(Licht|Schatten|dunkel)\b/i,
  sound: /\b(Geräusch|Lärm|Stille|hört|klingt)\b/i,
  temp: /\b(kalt|warm|kühl)\b/i,
  touch: /\b(weich|rau|trocken|feucht)\b/i,
  taste: /\b(bitter|salzig|Geschmack)\b/i,
};

const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as
  { slug: string; text: string; vocab: { word: string; surface?: string }[] }[];

for (const r of rows) {
  const cats = Object.entries(SENSES).filter(([, re]) => re.test(r.text)).map(([c]) => c);
  const paras = r.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const per = paras.map((p) =>
    r.vocab.filter((v) => new RegExp(`\\b${(v.surface ?? v.word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "iu").test(p)).length);
  const gordos = per.map((n, i) => [n, i] as const).filter(([n]) => n >= 6);
  const frases = r.text.split(/(?<=[.!?])\s+/).map((f) => f.trim().split(/\s+/).filter(Boolean).length);
  const largas = frases.filter((n) => n > 22);
  const flags = [
    cats.length === 0 ? "SIN ANCLA SENSORIAL" : cats.length >= 3 ? `sobrecarga: ${cats.join(",")}` : "",
    gordos.length ? `¶ de 6+: ${gordos.map(([n, i]) => `#${i + 1}=${n}`).join(" ")}` : "",
    largas.length ? `frases >22: ${largas.join(", ")}` : "",
  ].filter(Boolean);
  if (flags.length) console.log(`${r.slug}\n   ${flags.join(" | ")}\n   sentidos: ${cats.join(",") || "-"} · per ¶: [${per.join(", ")}]`);
}
