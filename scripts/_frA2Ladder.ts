/** Solo lectura: recirculacion del Friends FR A2 con la vara de journey-vocab-recirculation (portables sin anchor), base + lote candidato opcional. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs"; import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const J = "cmu04ereh000732z7px7naqa2";
  const rows = await p.journeyStory.findMany({ where: { journeyId: J, text: { not: null } }, select: { topic: true, slotIndex: true, text: true, vocab: true } });
  let stories = rows.map((r) => ({ key: `${r.topic}#${r.slotIndex}`, text: r.text!, vocab: (r.vocab as any[]) ?? [] }));
  if (process.argv[2]) { const c = JSON.parse(fs.readFileSync(process.argv[2], "utf8")); const keys = new Set(c.map((s: any) => `${s.topic}#${s.slotIndex}`));
    stories = stories.filter((s) => !keys.has(s.key)).concat(c.map((s: any) => ({ key: `${s.topic}#${s.slotIndex}`, text: s.text, vocab: s.vocab }))); }
  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = stories.map((s) => new Set(tok(s.text))); const textos = stories.map((s) => s.text.toLowerCase());
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
  const enc = (v: any) => { const k = clave(v); if (!k.includes(" ")) return cuerpos.filter((c) => c.has(k)).length; const l = String(v.word).toLowerCase(); return textos.filter((t) => t.includes(k) || t.includes(l)).length; };
  const port: any[] = []; let anc = 0, tot = 0;
  for (const s of stories) for (const v of s.vocab) { tot++; if (v.anchor) { anc++; continue; } port.push({ w: clave(v), n: enc(v), from: s.key }); }
  const media = port.reduce((a, b) => a + b.n, 0) / port.length; const solas = port.filter((x) => x.n <= 1);
  console.log(`historias ${stories.length} · portables ${port.length} · media ${media.toFixed(2)} (suelo A2 1.30) · cola ${(100 * solas.length / port.length).toFixed(0)}% (tope 80) · ancladas ${(100 * anc / tot).toFixed(0)}%`);
  if (process.argv.includes("--solas")) console.log("SOLAS:", solas.map((x) => x.w).join(", "));
  await p.$disconnect();
}
main();
