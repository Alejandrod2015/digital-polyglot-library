/** Trabajo: por historia de una tanda, palabras, % citado, bloques del lector con sus plazas. */
import * as fs from "fs";
import { renderedParagraphs, splitSentences } from "../../src/lib/readerParagraphs";
const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const d of data) {
  const blocks = renderedParagraphs(d.text);
  const per = blocks.map((b: string) => d.vocab.filter((v: any) => b.includes(v.surface ?? v.word)).length);
  const w = d.text.split(/\s+/).filter(Boolean).length;
  const q = [...d.text.matchAll(/“([^”]*)”/g)].reduce((a: number, m: any) => a + m[1].split(/\s+/).filter(Boolean).length, 0);
  const falta = d.vocab.filter((v: any) => !d.text.includes(v.surface ?? v.word)).map((v: any) => v.surface);
  if (process.argv[3] === "-v") blocks.forEach((b: string, i: number) => console.log(`   [${per[i]}] ${b}`));
  console.log(`${d.slotIndex} ${d.title} (${d.title.length}) · ${w} pal · citado ${Math.round((100 * q) / w)}% · ${splitSentences(d.text).length} frases · bloques [${per}] max ${Math.max(...per)}/${d.vocab.length} · anclas ${d.vocab.filter((v: any) => v.anchor).length} · sinopsis ${d.synopsis.split(/\s+/).length}${falta.length ? " · FALTAN " + falta : ""}`);
}
