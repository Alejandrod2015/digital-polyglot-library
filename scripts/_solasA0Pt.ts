// Solo lectura: plazas NO ancladas del Traveler PT-BR A0 nuevo con su numero de encuentros,
// contado igual que journey-vocab-recirculation (token exacto; multi-palabra por subcadena).
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const rows = (await p.journeyStory.findMany({ where: { journeyId: "cmtvpqsfv000832hgemzk20cl" }, select: { slug: true, text: true, vocab: true } })).filter((r) => r.text);
  const tok = (t: string) => new Set(t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = rows.map((r) => tok(r.text!));
  const textos = rows.map((r) => r.text!.toLowerCase());
  const lista: Array<{ n: number; w: string; slug: string; type: string }> = [];
  let anc = 0, todas = 0;
  for (const r of rows) for (const v of (r.vocab as any[])) {
    todas++;
    if (v.anchor) { anc++; continue; }
    const k = String(v.surface ?? v.word).toLowerCase().replace(/^(o|a)\s+/, "");
    const n = k.includes(" ")
      ? textos.filter((t) => t.includes(k) || t.includes(String(v.word).toLowerCase())).length
      : cuerpos.filter((c) => c.has(k)).length;
    lista.push({ n, w: k, slug: r.slug!, type: v.type });
  }
  const media = lista.reduce((a, b) => a + b.n, 0) / lista.length;
  const solas = lista.filter((x) => x.n <= 1);
  console.log(`${rows.length} historias · plazas ${todas} · ancladas ${anc} (${Math.round(100 * anc / todas)}%) · portables ${lista.length} · media ${media.toFixed(2)} · solas ${solas.length} (${Math.round(100 * solas.length / lista.length)}%)`);
  console.log("SOLAS: " + solas.map((x) => `${x.w}[${x.type[0]}]`).join(", "));
  console.log("DOS: " + lista.filter((x) => x.n === 2).map((x) => x.w).join(", "));
}
main().finally(() => p.$disconnect());
