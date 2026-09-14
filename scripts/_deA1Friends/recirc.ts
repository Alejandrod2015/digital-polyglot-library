// Solo lectura: reencuentros de las plazas del Friends DE A1 sobre todos los tN-data.json escritos (mismo criterio que journey-vocab-recirculation).
import { readFileSync, existsSync } from "fs";
const S: any[] = [];
for (let t = 1; t <= 7; t++) { const f = `scripts/_deA1Friends/t${t}-data.json`; if (existsSync(f)) S.push(...JSON.parse(readFileSync(f, "utf8"))); }
const tok = (t: string) => new Set(t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = S.map((s) => tok(s.text));
const port: Array<{ w: string; n: number; i: number }> = []; let anc = 0, total = 0;
S.forEach((s, i) => s.vocab.forEach((v: any) => { total++; if (v.anchor) { anc++; return; }
  const k = String(v.surface).toLowerCase(); port.push({ w: v.surface, n: cuerpos.filter((c) => c.has(k)).length, i }); }));
const media = port.reduce((a, b) => a + b.n, 0) / port.length;
const solas = port.filter((x) => x.n <= 1);
console.log(`${S.length} historias · portables media ${media.toFixed(2)} (A1 >= 1.6) · cola ${solas.length}/${port.length} = ${(100 * solas.length / port.length).toFixed(0)}% (tope 70) · ancladas ${anc}/${total} = ${(100 * anc / total).toFixed(0)}% (tope 30)`);
if (process.argv.includes("-v")) console.log("solas:", solas.map((x) => `${x.w}@${x.i + 1}`).join(", "));
