import * as fs from "node:fs";
import { renderedParagraphs } from "../../src/lib/readerParagraphs";
const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
for (const s of stories) {
  console.log(`\n== #${s.slotIndex} ${s.title}`);
  const blocks = renderedParagraphs(s.text);
  blocks.forEach((b: string, i: number) => {
    const hits = s.vocab.filter((v: any) => b.includes(v.surface ?? v.word)).map((v: any) => v.word);
    console.log(`[${i}] (${hits.length}) ${hits.join(", ")}\n    ${b.slice(0, 110)}...`);
  });
}
