import * as fs from "node:fs";
const file = process.argv[2];
const stories = JSON.parse(fs.readFileSync(file, "utf8")) as any[];
const taught = new Set(fs.readFileSync("scripts/_b2/lemas-ensenados.tsv", "utf8").split("\n").map(l => l.split("\t")[0]).filter(Boolean));
const enTanda = new Map<string, string>();
for (const s of stories) {
  const words = (s.text.match(/[\p{L}]+/gu) ?? []).length;
  const quoted = [...s.text.matchAll(/“([^”]+)”/g)].map((m: any) => (m[1].match(/[\p{L}]+/gu) ?? []).length).reduce((a: number, b: number) => a + b, 0);
  console.log(`\n== #${s.slotIndex} ${s.title} (${s.title.length} ch) · ${words}w · citado ${(100*quoted/words).toFixed(0)}% · vocab ${s.vocab.length}`);
  for (const v of s.vocab) {
    const surf = v.surface ?? v.word;
    const probs: string[] = [];
    if (!s.text.includes(surf)) probs.push("NO APARECE EN CUERPO");
    if (taught.has(v.word.toLowerCase())) probs.push("YA ENSEÑADA (traveler ES)");
    const prev = enTanda.get(v.word.toLowerCase());
    if (prev && prev !== s.slug) probs.push(`REPETIDA en ${prev}`);
    enTanda.set(v.word.toLowerCase(), s.slug);
    const dw = v.definition.split(/\s+/).length;
    if (dw < 4 || dw > 14) probs.push(`def ${dw} palabras`);
    if (probs.length) console.log(`  !! ${v.word}: ${probs.join(" · ")}`);
  }
}
console.log("\n(sin !! = limpio en estas comprobaciones locales)");
