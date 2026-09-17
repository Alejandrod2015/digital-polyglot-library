/** Cola de recirculacion del estado final (base + los 7 ficheros) con la misma
 *  regla que el gate fusionado: verbo suelto por cualquiera de sus formas
 *  (formasDeVerbo), resto por token exacto o subcadena. Solo imprime el numero. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
import { formasDeVerbo } from "../../src/lib/cefr/spanishConjugations";
const p = new PrismaClient();
const PORT = new Set(["verb", "adjective", "adverb", "expression"]);
(async () => {
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { topic: true, slotIndex: true, text: true, vocab: true } });
  const nuevo = new Map([1,2,3,4,5,6,7].flatMap((t) => (JSON.parse(fs.readFileSync(`scripts/_b2/t${t}.json`, "utf8")) as any[]).map((s) => [`${s.topic}#${s.slotIndex}`, s] as const)));
  const set = rows.map((r) => nuevo.get(`${r.topic}#${r.slotIndex}`) ?? { text: r.text ?? "", vocab: r.vocab as any[] });
  const cuerpos = set.map((s: any) => new Set(String(s.text).toLowerCase().match(/[\p{L}]+/gu) ?? []));
  const textos = set.map((s: any) => String(s.text).toLowerCase());
  let una = 0, total = 0, suma = 0;
  for (const s of set as any[]) for (const v of s.vocab ?? []) {
    if (v.anchor) continue;
    const k = String(v.surface ?? v.word).toLowerCase(), lema = String(v.word).toLowerCase();
    let n: number;
    if (k.includes(" ")) n = textos.filter((t) => t.includes(k) || t.includes(lema)).length;
    else if (v.type === "verb") { const f = new Set([k, ...(formasDeVerbo(lema) ?? [])]); n = cuerpos.filter((c) => [...f].some((x) => c.has(x))).length; }
    else n = cuerpos.filter((c) => c.has(k)).length;
    total++; suma += n; if (n <= 1) una++;
  }
  console.log(`DESPUES (gate fusionado, estado final, misma poblacion que el gate): media ${(suma / total).toFixed(2)} · cola ${una}/${total} (${Math.round(100 * una / total)}%, tope 80%)`);
  await p.$disconnect();
})();
