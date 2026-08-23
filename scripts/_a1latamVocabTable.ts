/** Tabla de vocabulario del A1 latam: una fila por historia con palabras,
 *  habla citada, plazas, escalera (encuentros por plaza, criterio del gate) y
 *  cuantas plazas salen una sola vez. Lee de la BASE. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
const palabras = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
(async () => {
  const j = await p.journey.findUnique({ where: { id: A1 } });
  const filas = await p.journeyStory.findMany({ where: { journeyId: A1 },
    select: { slug: true, title: true, topic: true, slotIndex: true, text: true, vocab: true } });
  const orden = j!.topics;
  filas.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const cuerpos = filas.map((f) => new Set(tok(String(f.text ?? ""))));
  console.log("| # | historia | palabras | citada | plazas | escalera | salen 1 vez |");
  console.log("|---|---|---|---|---|---|---|");
  let tot = 0, plz = 0;
  for (const [i, f] of filas.entries()) {
    const texto = String(f.text ?? "");
    const n = palabras(texto);
    let dentro = 0;
    for (const m of texto.matchAll(/“([^”]*)”/g)) dentro += palabras(m[1]);
    const voc = (f.vocab as any[]) ?? [];
    const enc = voc.map((v) => cuerpos.filter((c) => c.has(clave(v))).length);
    const media = enc.reduce((a, b) => a + b, 0) / (enc.length || 1);
    tot += enc.reduce((a, b) => a + b, 0); plz += enc.length;
    console.log(`| ${i + 1} | [${f.title}](http://localhost:3000/stories/${f.slug}) | ${n} | ${Math.round((dentro / n) * 100)}% | ${voc.length} | ${media.toFixed(2)} | ${enc.filter((x) => x <= 1).length} |`);
  }
  console.log(`\njourney: ${plz} plazas · escalera ${(tot / plz).toFixed(2)} (listón A1 1,9)`);
  await p.$disconnect();
})();
