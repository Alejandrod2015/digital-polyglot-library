/**
 * Chequeo mecanico del fichero de historias ANTES de saveStory: largo, habla
 * citada, bloques del lector, distribucion, raices repetidas, vocab en cuerpo,
 * pertenencia al pool y forma de apertura. No sustituye al gate; ahorra vueltas.
 */
import * as fs from "fs";
import { renderedParagraphs } from "../../src/lib/readerParagraphs";

const pool = new Set(fs.readFileSync("scripts/_b1/pool-limpio.txt", "utf8").split(/\r?\n/).filter(Boolean));
const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const W = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const quoted = (t: string) => {
  let inside = 0;
  for (const m of t.matchAll(/“([^”]*)”/g)) inside += W(m[1]);
  return (inside / W(t)) * 100;
};
const vistas = new Map<string, string[]>();
let malas = 0;
for (const d of stories) {
  const t: string = d.text;
  const bloques = renderedParagraphs(t);
  const vocab: Array<{ word: string; surface?: string; type: string; definition: string; register?: string }> = d.vocab;
  const porBloque = bloques.map((b) => vocab.filter((v) => b.includes(v.surface ?? v.word)).length);
  const parras = t.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const porParra = parras.map((p) => vocab.filter((v) => p.includes(v.surface ?? v.word)).length);
  const problemas: string[] = [];
  const w = W(t), q = quoted(t);
  if (w < 115 || w > 170) problemas.push(`palabras ${w} (115-170)`);
  if (q < 25 || q > 35) problemas.push(`habla citada ${q.toFixed(1)}% (25-35)`);
  if (vocab.length < 20 || vocab.length > Math.max(25, Math.round(w / 9))) problemas.push(`vocab ${vocab.length}`);
  const sinCuerpo = vocab.filter((v) => !t.toLowerCase().includes((v.surface ?? v.word).toLowerCase()));
  if (sinCuerpo.length) problemas.push(`fuera del cuerpo: ${sinCuerpo.map((v) => v.word).join(",")}`);
  const worst = Math.max(...porBloque), empty = porBloque.filter((n) => n === 0).length;
  if (worst / vocab.length > 0.3) problemas.push(`bloque con ${worst}/${vocab.length} (>30%)`);
  if (empty > 0 && worst >= 6) problemas.push(`cluster: ${empty} bloque(s) vacio(s) y otro con ${worst}`);
  if (empty > 0) problemas.push(`${empty} bloque(s) del lector sin vocab`);
  if (Math.max(...porParra) / vocab.length > 0.35) problemas.push(`parrafo con ${Math.max(...porParra)}/${vocab.length} (>35%)`);
  const raiz = new Map<string, string[]>();
  for (const v of vocab) {
    const r = v.word.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 5);
    if (r.length < 3) continue;
    raiz.set(r, [...(raiz.get(r) ?? []), v.word]);
  }
  const dup = [...raiz].filter(([, ws]) => ws.length > 1);
  if (dup.length) problemas.push(`misma raiz: ${dup.map(([r, ws]) => ws.join("+")).join(" ")}`);
  const fuera = vocab.filter((v) => (v.type ?? "") !== "expression" && !(v.register === "cultural") && !pool.has(v.word));
  if (fuera.length) problemas.push(`fuera del pool: ${fuera.map((v) => v.word).join(",")}`);
  const defMal = vocab.filter((v) => W(v.definition) < 8 || W(v.definition) > 14 || v.definition.length > 120);
  if (defMal.length) problemas.push(`definiciones: ${defMal.map((v) => `${v.word}(${W(v.definition)}w)`).join(",")}`);
  const primerBloque = bloques[0] ?? "";
  if (/“/.test(primerBloque)) problemas.push("el primer bloque del lector ya lleva comillas");
  const PARES: Array<[string, string]> = [["“", "”"]];
  for (const [i, b] of bloques.entries()) for (const [a, c] of PARES) {
    if ((b.split(a).length - 1) !== (b.split(c).length - 1)) problemas.push(`bloque ${i + 1} parte una cita`);
  }
  const titulo: string = d.title;
  if (W(titulo) < 2 || W(titulo) > 6) problemas.push(`titulo ${W(titulo)} palabras`);
  const syn = W(d.synopsis);
  if (syn < 45 || syn > 90) problemas.push(`sinopsis ${syn} palabras (45-90)`);
  for (const v of vocab) {
    const k = (v.surface ?? v.word).toLowerCase();
    vistas.set(k, [...(vistas.get(k) ?? []), d.slug ?? `${d.topic}#${d.slotIndex}`]);
  }
  const marca = problemas.length ? "FAIL" : "ok  ";
  if (problemas.length) malas++;
  console.log(`${marca} ${String(d.topic + "#" + d.slotIndex).padEnd(30)} ${String(w).padStart(3)}w  cita ${q.toFixed(0).padStart(2)}%  bloques [${porBloque.join(",")}]  ${d.arcType}`);
  for (const p of problemas) console.log(`       . ${p}`);
}
const repes = [...vistas].filter(([, v]) => v.length > 1);
if (repes.length) console.log(`\nREPETIDAS dentro del journey: ${repes.map(([k, v]) => `${k}(${v.length})`).join(", ")}`);

// Escalera de recirculacion, formula del gate.
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = stories.map((s: { text: string }) => new Set(tok(s.text)));
const enc: Array<[string, number]> = [];
for (const s of stories) for (const v of s.vocab)
  enc.push([String(v.surface ?? v.word), cuerpos.filter((c: Set<string>) => c.has(String(v.surface ?? v.word).toLowerCase())).length]);
const media = enc.reduce((a, b) => a + b[1], 0) / enc.length;
console.log(`\nescalera: media ${media.toFixed(2)} (piso B1 2,5) · ${enc.filter(([, n]) => n <= 1).length}/${enc.length} salen una sola vez`);
console.log(`${malas}/${stories.length} historias con algo que arreglar.`);
