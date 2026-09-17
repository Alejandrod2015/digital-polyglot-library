// Solo lectura: bloques que pinta el lector (3 frases) y pildoras por bloque, como saveStory.
import { readFileSync } from "fs";
import { renderedParagraphs } from "../../src/lib/readerParagraphs";
for (const s of JSON.parse(readFileSync(process.argv[2], "utf8"))) {
  console.log(`\n### ${s.topic}#${s.slotIndex} ${s.title}`);
  for (const b of renderedParagraphs(s.text)) {
    const p = s.vocab.filter((v: any) => b.includes(v.surface ?? v.word)).map((v: any) => v.surface ?? v.word);
    console.log(`  [${p.length}] ${b.slice(0, 90)}... {${p.join(", ")}}`);
  }
}
