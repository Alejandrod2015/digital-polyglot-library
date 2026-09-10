/** Simula journey-vocab-recirculation con la palabra suelta LEMATIZADA: una plaza
 *  verbal cuenta en un cuerpo si algun token de ese cuerpo tiene su mismo infinitivo
 *  (spanishInfinitiveOf), no solo si aparece la superficie exacta. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
import { spanishInfinitiveOf } from "../../src/lib/cefr/spanishConjugations";
const p = new PrismaClient();
const PORT = new Set(["verb", "adjective", "adverb", "expression"]);
const toks = (t: string) => (t.toLowerCase().match(/[\p{L}]+/gu) ?? []);
(async () => {
  for (const w of ["rindió", "rinde", "cobró", "cobra", "festejaba", "hojeó", "tronó", "presumía", "delató"]) process.stdout.write(`${w}->${spanishInfinitiveOf(w)}  `);
  console.log();
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { topic: true, slotIndex: true, text: true, vocab: true } });
  const extra = process.argv.slice(2).flatMap((f) => JSON.parse(fs.readFileSync(f, "utf8")) as any[]);
  const nuevo = new Map(extra.map((s) => [`${s.topic}#${s.slotIndex}`, s]));
  const set = rows.map((r) => { const n = nuevo.get(`${r.topic}#${r.slotIndex}`); return n ? { text: n.text, vocab: n.vocab } : { text: r.text ?? "", vocab: (r.vocab ?? []) as any[] }; });
  const cuerpos = set.map((s) => { const t = toks(s.text); return { formas: new Set(t), lemas: new Set(t.map((x) => spanishInfinitiveOf(x) ?? x)) }; });
  const textos = set.map((s) => s.text.toLowerCase());
  let una = 0, total = 0, sum = 0;
  for (const s of set) for (const v of s.vocab) {
    if (!PORT.has(String(v.type)) || v.anchor) continue;
    const k = String(v.surface ?? v.word).toLowerCase(); const lema = String(v.word).toLowerCase();
    const n = k.includes(" ") ? textos.filter((t) => t.includes(k) || t.includes(lema)).length
      : cuerpos.filter((c) => c.formas.has(k) || c.lemas.has(lema)).length;
    total++; sum += n; if (n <= 1) una++;
  }
  console.log(`LEMATIZADA: media ${(sum / total).toFixed(2)} · cola ${una}/${total} (${Math.round(100 * una / total)}%, tope 80%)`);
  await p.$disconnect();
})();
