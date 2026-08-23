/** La tabla del journey, historia a historia, con su escalera propia. */
import * as fs from "fs";
const S = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const W = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const quoted = (t: string) => { let n = 0; for (const m of t.matchAll(/“([^”]*)”/g)) n += W(m[1]); return (n / W(t)) * 100; };
const cuerpos = S.map((s: any) => new Set(tok(s.text)));
const filas = S.map((s: any, i: number) => {
  const enc = s.vocab.map((v: any) => cuerpos.filter((c: Set<string>) => c.has(String(v.surface ?? v.word).toLowerCase())).length);
  return {
    n: i + 1, slug: s.slug, titulo: s.title, tema: s.topic, arco: s.arcType,
    palabras: W(s.text), citada: Math.round(quoted(s.text)), plazas: s.vocab.length,
    escalera: enc.reduce((a: number, b: number) => a + b, 0) / enc.length,
    unaVez: enc.filter((n: number) => n <= 1).length,
  };
});
console.log(JSON.stringify(filas, null, 1));
