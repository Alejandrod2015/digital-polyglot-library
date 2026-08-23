/** Mide la escalera (y los cierres) sobre un fichero de tanda, sin guardar. */
import { readFileSync } from "fs";
const stories = JSON.parse(readFileSync(process.argv[2], "utf8"));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = stories.map((s: any) => new Set(tok(s.text)));
const enc: Array<{ w: string; slug: string; n: number }> = [];
for (const s of stories) for (const v of (s.vocab ?? [])) {
  const k = String(v.surface ?? v.word).toLowerCase();
  enc.push({ w: k, slug: s.slug ?? `${s.topic}#${s.slotIndex}`, n: cuerpos.filter((c: Set<string>) => c.has(k)).length });
}
const media = enc.reduce((a, e) => a + e.n, 0) / enc.length;
const unaVez = enc.filter((e) => e.n <= 1).length;
console.log(`escalera: media ${media.toFixed(2)} · ${unaVez}/${enc.length} salen una sola vez`);
const falta = (1.6 - media) * enc.length;
console.log(`para 1.6 faltan ${Math.ceil(falta)} encuentros (aprox ${Math.ceil(falta / stories.length)} por historia)`);
if (process.argv[3] === "--donde") {
  // Que palabras YA enseñadas podrian colarse en cada historia: las que no
  // estan en su cuerpo y salen poco en el journey.
  for (const s of stories) {
    const mio = new Set(tok(s.text));
    const cand = enc.filter((e) => e.slug !== (s.slug ?? `${s.topic}#${s.slotIndex}`) && !mio.has(e.w) && e.n <= 1)
      .map((e) => e.w);
    console.log(`  ${s.slug ?? s.topic}: ${[...new Set(cand)].slice(0, 14).join(" ")}`);
  }
}
