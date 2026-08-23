import * as fs from "fs";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
for (const s of stories) {
  const u = String(s.text).split(/\n\s*\n/).map((p: string) => renderedParagraphs(p, 1).length);
  const total = u.reduce((a: number, b: number) => a + b, 0);
  console.log(`${(s.topic + "#" + s.slotIndex).padEnd(24)} parrafos ${JSON.stringify(u)} total ${total}`);
}
