/** Solo lectura: muestra los bloques que pinta el lector (renderedParagraphs) y las plazas de vocab en cada uno. */
import * as fs from "fs"; import { renderedParagraphs } from "../src/lib/readerParagraphs";
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const s of S) { if (process.argv[3] && String(s.slotIndex) !== process.argv[3]) continue;
  const bl = renderedParagraphs(s.text) as string[];
  console.log("##", s.title);
  bl.forEach((b: string, i: number) => { const hits = s.vocab.filter((v: any) => b.toLowerCase().includes(String(v.surface).toLowerCase())).map((v: any) => v.surface);
    console.log(` [${i}] ${hits.length}: ${hits.join(" | ")}\n     ${b.slice(0, 140)}`); }); }
