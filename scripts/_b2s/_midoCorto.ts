/** Mide un tema acortado antes de guardarlo: palabras, oraciones, citado, bloques del lector con sus plazas,
 *  vocab presente y banda gramatical del tema. Solo lee el JSON. */
import { readFileSync } from "fs";
import { mide } from "../_gramProbe";
import { renderedParagraphs } from "../../src/lib/readerParagraphs";
const L = JSON.parse(readFileSync(process.argv[2], "utf8"));
const t = mide(L.map((s: any) => s.text).join("\n"));
console.log(`TEMA ${t.oraciones} or. · subjI ${t.usos["subj. imperfecto"]} (${t.tokens["subj. imperfecto"].join("|")}) · cond ${t.usos["condicional"]} (${t.tokens["condicional"].join("|")}) · estInd ${t.usos["estilo indirecto"]} (${t.tokens["estilo indirecto"].join("|")})`);
for (const s of L) {
  const w = s.text.split(/\s+/).length;
  const q = (s.text.match(/“[^”]*”/g) ?? []).join(" ").split(/\s+/).filter(Boolean).length;
  const bloques = renderedParagraphs(s.text).map((b: string) => b.toLowerCase());
  const por = bloques.map(() => 0); const falta: string[] = [];
  for (const v of s.vocab) {
    const sup = String(v.surface ?? v.word).toLowerCase();
    const i = bloques.findIndex((b: string) => b.includes(sup));
    if (i < 0) falta.push(sup); else por[i]++;
  }
  const max = Math.max(...por);
  const dosPuntos = s.text.split("\n\n").map((p: string, i: number) => [i + 1, p] as [number, string])
    .filter(([, p]) => /^\s*[A-ZÁÉÍÓÚÑÜ][\wáéíóúñçüö' ]{1,20}:\s/.test(p) || /^[\p{Lu}][\p{L}\s'-]*:\s/u.test(p)).map(([i]) => i);
  console.log(`${s.title.padEnd(24)} ${w} pal · ${s.text.split("\n\n").length} parr · citado ${Math.round(100 * q / w)}% · bloques [${por.join(", ")}] max ${Math.round(100 * max / s.vocab.length)}%${falta.length ? " · FALTA " + falta.join(", ") : ""}${dosPuntos.length ? " · DOS PUNTOS al abrir parr " + dosPuntos.join(",") : ""}`);
}
