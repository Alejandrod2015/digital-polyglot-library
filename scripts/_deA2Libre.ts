/** Dice si una palabra candidata de vocab ya la ensena otro journey aleman. */
import * as fs from "fs";
const SP = process.env.SP!;
const de = JSON.parse(fs.readFileSync(`${SP}/de-vocab.json`, "utf8")) as Record<string, string[]>;
const mismoTipo = Object.entries(de).filter(([k]) => k.startsWith("Friends")).flatMap(([,v]) => v);
const otroTipo = Object.entries(de).filter(([k]) => !k.startsWith("Friends")).flatMap(([,v]) => v);
const norm = (s: string) => s.replace(/^(der|die|das)\s+/i, "").toLowerCase();
const A = new Set(mismoTipo.map(norm)), B = new Set(otroTipo.map(norm));
for (const w of process.argv.slice(2)) {
  const n = norm(w);
  const tags = [A.has(n) ? "FRIENDS(cero tolerancia)" : "", B.has(n) ? "otro-tipo(max 2)" : ""].filter(Boolean);
  console.log(`${w.padEnd(22)} ${tags.length ? tags.join(" + ") : "libre"}`);
}
