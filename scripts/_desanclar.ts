import fs from "fs";
type V = { word: string; surface?: string; anchor?: boolean };
type S = { topic: string; slotIndex: number; text: string; vocab: V[] };
const f = process.argv[2], quita = Number(process.argv[3] ?? 2);
const d = JSON.parse(fs.readFileSync(f, "utf8")) as S[];
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = d.map((s) => new Set(tok(s.text)));
const clave = (v: V) => String(v.surface ?? v.word).toLowerCase();
const n = (v: V) => cuerpos.filter((c) => c.has(clave(v))).length;
for (const s of d) {
  const anc = s.vocab.filter((v) => v.anchor).sort((a, b) => n(b) - n(a));
  for (const v of anc.slice(0, quita)) delete v.anchor;
  console.log(`${s.topic}#${s.slotIndex} sueltas: ${anc.slice(0, quita).map((v) => v.word + ":" + n(v)).join(" ")}`);
}
fs.writeFileSync(f, JSON.stringify(d, null, 1));
