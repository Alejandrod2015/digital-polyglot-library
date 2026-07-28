/** Rewrite dumped payloads with the reader's computed windows, so the same
 * ruler can score exactly what the user sees. Also reports how far any word
 * moved from its original start. */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { buildWordWindows } from "../src/lib/karaokeWordWindows";

const [src, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
let maxShift = 0, shifted = 0, total = 0, escaped = 0;
for (const f of readdirSync(src).sort()) {
  if (!f.endsWith(".json") || f.startsWith("_")) continue;
  const slug = f.slice(0, -5);
  const mp3 = path.join(src, `${slug}.mp3`);
  const doc = JSON.parse(readFileSync(path.join(src, f), "utf-8"));
  const windows = buildWordWindows(doc.words, doc.audioDurationSec);
  const origin: number[] = doc.words.map((w: { startSec: number | null }) => w.startSec ?? NaN);
  // next distinct start per word, to prove nothing crosses into a neighbour
  for (const win of windows) {
    const before = origin[win.index];
    total += 1;
    const shift = win.startSec - before;
    if (Math.abs(shift) > 1e-9) shifted += 1;
    if (Math.abs(shift) > maxShift) maxShift = Math.abs(shift);
    if (shift < -1e-9) escaped += 1; // moved EARLIER than its original start
    let nextDistinct = Infinity;
    for (let k = win.index + 1; k < origin.length; k += 1) {
      if (Number.isFinite(origin[k]) && origin[k] > before) { nextDistinct = origin[k]; break; }
    }
    if (win.startSec >= nextDistinct) escaped += 1; // crossed into the next word
    doc.words[win.index].startSec = win.startSec;
  }
  writeFileSync(path.join(out, f), JSON.stringify(doc, null, 2));
  copyFileSync(mp3, path.join(out, `${slug}.mp3`));
}
console.log(`palabras: ${total} | reubicadas dentro de su empate: ${shifted}`);
console.log(`desplazamiento maximo: ${maxShift.toFixed(3)}s`);
console.log(`palabras que salieron de su ventana original: ${escaped}`);
