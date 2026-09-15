// Solo lectura: bloques que pinta el lector y plazas que caen en cada uno.
import fs from "node:fs";
import { renderedParagraphs } from "../../src/lib/readerParagraphs";
const [file, idx] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(file, "utf8"));
for (const [i, s] of d.entries()) {
  if (idx !== undefined && Number(idx) !== i) continue;
  const bloques = renderedParagraphs(s.text) as string[];
  console.log(`## ${s.title}`);
  bloques.forEach((b: string, k: number) => {
    const bl = b.toLowerCase();
    const hits = s.vocab.filter((v: any) => bl.includes(String(v.surface).toLowerCase())).map((v: any) => v.surface);
    console.log(`  [${k}] ${hits.length}: ${hits.join(" | ")}\n      ${b.slice(0, 90)}...`);
  });
}
