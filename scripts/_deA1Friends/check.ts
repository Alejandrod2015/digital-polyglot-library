// Solo lectura: sonda rapida de un tema del Friends DE A1 antes del --dry.
// npx tsx scripts/_deA1Friends/check.ts <tN-data.json> <de.json>
import { readFileSync } from "fs";
import { isGermanA1A2 } from "../../src/lib/cefr/germanA1A2";
import { renderedParagraphs } from "../../src/lib/readerParagraphs";
const [file, dump] = process.argv.slice(2);
const data = JSON.parse(readFileSync(file, "utf8"));
const d = JSON.parse(readFileSync(dump, "utf8"));
const OWN = "cmu0dqr6y0007j8o52i1s3gf7";
const taught = new Map<string, Set<string>>();
for (const j of d.journeys) { if (j.id === OWN) continue; for (const s of j.stories) for (const v of s.vocab ?? []) {
  const k = String(v.word ?? "").toLowerCase().replace(/^(der|die|das|sich) /, "").trim();
  if (!taught.has(k)) taught.set(k, new Set()); taught.get(k)!.add(`${j.name}-${j.levels[0]}`);
} }
import { readdirSync } from "fs";
const SEP = ["an", "auf", "aus", "ein", "nach", "vor", "zu", "ab", "mit", "bei", "ge", "ver", "be", "er", "ent"];
const sp = (w: string) => { let l = w.toLowerCase().replace(/^(der|die|das) /, ""); for (const p of SEP) if (l.startsWith(p) && l.length > p.length + 3) return l.slice(p.length); return l; };
const propias = new Set<string>();
for (const f of readdirSync("scripts/_deA1Friends").filter((x) => /^t\d-data\.json$/.test(x) && `scripts/_deA1Friends/${x}` !== file))
  for (const s of JSON.parse(readFileSync(`scripts/_deA1Friends/${f}`, "utf8"))) for (const v of s.vocab) propias.add(sp(v.word));
const O = "“", C = "”";
const seen = new Map<string, number>();
for (const s of data) {
  const t: string = s.text;
  const words = t.match(/[\p{L}\d]+/gu)!.length;
  const q = [...t.matchAll(/“([^”]*)”/g)].map((m) => m[1].match(/[\p{L}\d]+/gu)?.length ?? 0).reduce((a, b) => a + b, 0);
  const narr = t.replace(/“[^”]*”/g, " ");
  const L = t.split(/(?<=[.!?”])\s+/).map((x) => x.match(/[\p{L}\d]+/gu)?.length ?? 0).filter((n) => n > 1).sort((a, b) => a - b);
  const paras = t.split("\n\n");
  const pills = paras.map((p) => s.vocab.filter((v: any) => p.includes(v.surface)).length);
  console.log(`\n## ${s.title} (${s.title.length}c) · ${words} pal · citado ${(100 * q / words).toFixed(0)}% · frases med ${L[L.length >> 1]} max ${L[L.length - 1]} · parrafos ${paras.length} pills ${pills.join("/")} · vocab ${s.vocab.length}`);
  const blocks = renderedParagraphs(t);
  console.log("  bloques: " + blocks.map((b: string) => s.vocab.filter((v: any) => b.includes(v.surface)).length).join("/") + (process.argv.includes("-w") ? "\n    " + blocks.map((b: string) => "[" + s.vocab.filter((v: any) => b.includes(v.surface)).map((v: any) => v.surface).join(",") + "]").join(" ") : "") + (process.argv.includes("-b") ? "\n    " + blocks.join("\n    ") : ""));
  const probs: string[] = [];
  const roots = new Map<string, string[]>(); for (const v of s.vocab) { const r = sp(v.word).slice(0, 5); roots.set(r, [...(roots.get(r) ?? []), v.word]); }
  for (const [r, ws] of roots) if (ws.length > 1) probs.push(`MISMA-RAIZ ${r}: ${ws.join("+")}`);
  const art = new Map<string, string[]>(); for (const v of s.vocab) { const m = v.word.match(/^(der|die|das) (.)/); if (m) { const k = m[1] + m[2]; art.set(k, [...(art.get(k) ?? []), v.word]); } }
  for (const [r, ws] of art) if (ws.length > 1) probs.push(`BUG-CIERRE ${r}: ${ws.join("+")}`);
  let fuera = 0;
  for (const v of s.vocab) {
    const k = v.word.toLowerCase().replace(/^(der|die|das|sich) /, "").trim();
    if (!t.includes(v.surface)) probs.push(`NO EN CUERPO ${v.surface}`);
    if (propias.has(sp(v.word))) probs.push(`YA-EN-ESTE(lema ${sp(v.word)}) ${v.word}`);
    const tt = taught.get(k);
    if (tt) {
      const fr = [...tt].some((x) => x.startsWith("Friends"));
      const port = ["verb", "adjective", "adverb", "expression"].includes(v.type);
      if (!port) probs.push(`YA-ANCLA ${v.word} (${[...tt].join("/")})`);
    }
    if (!isGermanA1A2(v.word)) fuera++, probs.push(`fuera-lista ${v.word}`);
    const n = v.definition.split(/\s+/).length; if (n < 8 || n > 14) probs.push(`def ${n}w ${v.word}`);
    seen.set(sp(v.word), (seen.get(sp(v.word)) ?? 0) + 1);
  }
  console.log(`  fuera de lista: ${fuera}` + (probs.length ? `\n  - ${probs.join("\n  - ")}` : ""));
}
const dup = [...seen].filter(([, n]) => n > 1); if (dup.length) console.log("\nREPETIDAS en el tema:", dup.map(([k]) => k).join(", "));
