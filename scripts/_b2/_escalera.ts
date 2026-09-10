/** Mide la escalera de recirculacion del B2 con la MISMA formula del check
 *  journey-vocab-recirculation, sobre las 18 guardadas + las 3 del t7.json.
 *  Solo MIDE: el liston B2 no existe y no se calibra desde aqui. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const db = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h", text: { not: "" } }, select: { slug: true, text: true, vocab: true } });
  const t7 = JSON.parse(fs.readFileSync("scripts/_b2/t7.json", "utf8")) as any[];
  const all = [...db.map(s => ({ text: s.text!, vocab: (s.vocab as any[]) ?? [] })), ...t7.map(s => ({ text: s.text, vocab: s.vocab }))];
  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = all.map(s => new Set(tok(s.text)));
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
  const todas: Array<{ n: number; anchor: boolean }> = [];
  for (const s of all) for (const v of s.vocab) todas.push({ n: cuerpos.filter(c => c.has(clave(v))).length, anchor: Boolean(v.anchor) });
  const port = todas.filter(x => !x.anchor), anc = todas.filter(x => x.anchor);
  const media = port.reduce((a, b) => a + b.n, 0) / port.length;
  const unaVez = port.filter(x => x.n <= 1).length;
  console.log(`historias: ${all.length} · plazas: ${todas.length} (portables ${port.length}, ancladas ${anc.length} = ${(100*anc.length/todas.length).toFixed(1)}%)`);
  console.log(`portables: media ${media.toFixed(2)} encuentros/plaza · cola ${unaVez}/${port.length} = ${(100*unaVez/port.length).toFixed(1)}% salen una sola vez`);
  console.log(`(referencia, sin ser liston: A0 2,5 · A1 1,6 · A2 1,3 · B1 provisional 1,2 · topes cola A1 70% A2/B1 80%)`);
  await p.$disconnect();
})();
// Segunda pasada: separa palabras sueltas de expresiones multi-palabra, porque
// la formula del check tokeniza por palabra y una expresion NUNCA aparece en el
// set de tokens: puntua 0 aunque se repita literal en cinco cuerpos.
