/** Para las historias de la COLA: qué palabras ya enseñadas en historias
 *  anteriores aparecen YA en su cuerpo (plaza gratis) y cuáles de sus plazas
 *  actuales no recirculan (candidatas a ceder el sitio). */
import fs from "node:fs";
const d = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as Array<{ slug: string; topic: string; slotIndex: number; text: string; vocab: Array<{ word: string; surface?: string; anchor?: boolean }> }>;
const orden = ["manaus", "florianopolis", "foz-do-iguacu", "olinda", "belem", "pantanal", "ouro-preto"];
d.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = d.map((s) => new Set(tok(s.text)));
const sup = (v: { word: string; surface?: string }) => String(v.surface ?? v.word).toLowerCase();
const desde = Number(process.argv[3] ?? 15);
for (const [i, s] of d.entries()) {
  if (i < desde) continue;
  const antes = new Set<string>();
  for (let k = 0; k < i; k++) for (const v of d[k].vocab) antes.add(sup(v));
  const propias = new Set(s.vocab.map(sup));
  const gratis = [...antes].filter((w) => cuerpos[i].has(w) && !propias.has(w));
  const noRecirc = s.vocab.filter((v) => !v.anchor && cuerpos.filter((c) => c.has(sup(v))).length <= 1).map(sup);
  console.log(`\n${i + 1} ${s.slug}`);
  console.log(`   ya en el cuerpo y enseñadas antes (${gratis.length}): ${gratis.join(" ")}`);
  console.log(`   plazas suyas que no recirculan (${noRecirc.length}): ${noRecirc.join(" ")}`);
}
