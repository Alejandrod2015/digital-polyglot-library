/** Trabajo: mide la recirculacion del journey (misma formula que journey-vocab-recirculation) con la base + un fichero de tanda opcional. Uso: recirc.ts [tanda.json] [--lista] */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
import { isFrenchA1A2 } from "../../src/lib/cefr/frenchA1A2";
const J = "cmu0doigc0007j8e292tycths";
async function main() {
  const p = new PrismaClient();
  let st = (await p.journeyStory.findMany({ where: { journeyId: J, text: { not: null } }, select: { topic: true, slotIndex: true, text: true, vocab: true } })) as any[];
  await p.$disconnect();
  const f = process.argv.find((a) => a.endsWith(".json"));
  if (f) { const d = JSON.parse(fs.readFileSync(f, "utf8")); const k = new Set(d.map((x: any) => `${x.topic}#${x.slotIndex}`)); st = st.filter((s) => !k.has(`${s.topic}#${s.slotIndex}`)).concat(d); }
  const tok = (t: string) => t.toLowerCase().match(/\p{L}+/gu) ?? [];
  const cuerpos = st.map((s) => new Set(tok(s.text))); const textos = st.map((s) => s.text.toLowerCase());
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
  const enc = (v: any) => { const k = clave(v); if (!k.includes(" ")) return cuerpos.filter((c) => c.has(k)).length; const l = String(v.word).toLowerCase(); return textos.filter((t) => t.includes(k) || t.includes(l)).length; };
  const port: any[] = []; let anc = 0, tot = 0;
  for (const s of st) for (const v of s.vocab ?? []) { tot++; if (v.anchor) { anc++; continue; } port.push({ w: v.surface ?? v.word, n: enc(v), t: s.topic }); }
  let dentro = 0; for (const s of st) for (const v of s.vocab ?? []) if (isFrenchA1A2(String(v.word))) dentro++;
  console.log(`suelo de nivel: ${tot - dentro}/${tot} fuera de A1-A2 (${Math.round((100 * (tot - dentro)) / tot)}%, suelo 60%)`);
  const una = port.filter((x) => x.n <= 1).length;
  console.log(`${st.length} historias · portables ${port.length} media ${(port.reduce((a, b) => a + b.n, 0) / port.length).toFixed(2)} (suelo 1.2) · cola ${una}/${port.length} ${Math.round((100 * una) / port.length)}% (tope 80%) · ancladas ${anc}/${tot}`);
  const faltan = Math.ceil(port.length * 0.2 - (port.length - una));
  console.log(`para cola 80% faltan ${faltan > 0 ? faltan : 0} portables con 2+ encuentros (sobre las plazas actuales)`);
  if (process.argv.includes("--lista")) console.log("con 2+:", port.filter((x) => x.n > 1).map((x) => `${x.w}(${x.n})`).join(", "), "\nuna vez:", port.filter((x) => x.n <= 1).map((x) => x.w).join(" | "));
}
main();
