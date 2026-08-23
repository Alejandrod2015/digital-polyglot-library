import { renderedParagraphs } from "../src/lib/readerParagraphs";
import fs from "fs";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const s of d) {
  
  const blocks = renderedParagraphs(s.text);
  console.log("\n### " + s.topic + "#" + s.slotIndex);
  blocks.forEach((b: string, i: number) => {
    const hits = s.vocab.filter((v: any) => b.includes(v.surface)).map((v: any) => v.surface);
    console.log(`[${i}] ${hits.length}: ${hits.join(",")}\n    ${b.slice(0, 160)}`);
  });
}
