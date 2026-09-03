import * as fs from "fs";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cuenta = (t: string, vocab: any[]) => vocab.filter((v) => new RegExp(`\\b${esc(String(v.surface ?? v.word).toLowerCase())}\\b`, "iu").test(t)).length;
const quien = (t: string, vocab: any[]) => vocab.filter((v) => new RegExp(`\\b${esc(String(v.surface ?? v.word).toLowerCase())}\\b`, "iu").test(t)).map((v) => v.surface);
const c = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
for (const s of c) {
  const pars = String(s.text).split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const porPar = pars.map((p) => cuenta(p, s.vocab));
  const bl = renderedParagraphs(s.text);
  const porBl = bl.map((b: string) => cuenta(b, s.vocab));
  console.log(`\n${s.slotIndex} ${s.title}`);
  console.log(`   parrafos [${porPar.join(", ")}] max ${Math.max(...porPar)} (tope 7; ningun 0 si hay un 6+)`);
  console.log(`   bloques  [${porBl.join(", ")}] max ${Math.max(...porBl)} (tope 6)`);
  if (process.argv[3] === "-v") {
    pars.forEach((p, i) => console.log(`     P${i + 1}: ${quien(p, s.vocab).join(",")}`));
    bl.forEach((b: string, i: number) => console.log(`     B${i + 1}: ${quien(b, s.vocab).join(",")}`));
  }
}
