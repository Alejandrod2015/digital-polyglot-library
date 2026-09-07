import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const db = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h", text: { not: "" } }, select: { text: true, vocab: true } });
  const t7 = JSON.parse(fs.readFileSync("scripts/_b2/t7.json", "utf8")) as any[];
  const all = [...db.map(s => ({ text: s.text!, vocab: (s.vocab as any[]) ?? [] })), ...t7.map(s => ({ text: s.text, vocab: s.vocab }))];
  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = all.map(s => new Set(tok(s.text)));
  const textos = all.map(s => s.text.toLowerCase());
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
  type R = { n: number; anchor: boolean; multi: boolean };
  const todas: R[] = [];
  for (const s of all) for (const v of s.vocab) {
    const k = clave(v);
    const multi = k.includes(" ");
    const lema = String(v.word).toLowerCase();
    const n = multi
      ? textos.filter(t => t.includes(k) || t.includes(lema)).length
      : cuerpos.filter(c => c.has(k)).length;
    todas.push({ n, anchor: Boolean(v.anchor), multi });
  }
  const port = todas.filter(x => !x.anchor);
  const uni = port.filter(x => !x.multi), multi = port.filter(x => x.multi);
  const f = (xs: R[]) => `${xs.length} plazas · media ${(xs.reduce((a,b)=>a+b.n,0)/xs.length).toFixed(2)} · cola ${(100*xs.filter(x=>x.n<=1).length/xs.length).toFixed(0)}%`;
  console.log("portables de UNA palabra (lo que la formula del check si ve):", f(uni));
  console.log("expresiones multi-palabra (buscadas como substring, que el check NO hace):", f(multi));
  const todo = [...uni, ...multi];
  console.log("union (si el check midiera substring para expresiones):", f(todo));
  await p.$disconnect();
})();
