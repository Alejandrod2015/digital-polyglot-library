import fs from "fs";
type V = { word: string; surface?: string; anchor?: boolean };
type S = { topic: string; slotIndex: number; slug?: string; text: string; vocab: V[] };
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as S[];
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = d.map((s) => new Set(tok(s.text)));
const clave = (v: V) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
const n = (v: V) => cuerpos.filter((c) => c.has(clave(v))).length;
let port: number[] = [], anc = 0;
const plan: string[] = [];
for (const s of d) {
  const A = s.vocab.filter((v) => v.anchor), P = s.vocab.filter((v) => !v.anchor);
  const orden = A.map((v) => ({ v, n: n(v) })).sort((a, b) => b.n - a.n);
  plan.push(`${s.topic}#${s.slotIndex} anc[${orden.map((x) => x.v.word + ":" + x.n).join(" ")}] port[${P.map((v) => v.word + ":" + n(v)).join(" ")}]`);
  anc += A.length; port.push(...P.map(n));
}
console.log(plan.join("\n"));
const media = port.reduce((a, b) => a + b, 0) / port.length;
console.log(`\nPORTABLES ${port.length} media ${media.toFixed(2)} · una vez ${port.filter((x) => x <= 1).length} · ANCLADAS ${anc}/${anc + port.length} (${Math.round((anc / (anc + port.length)) * 100)}%)`);
