/** Escalera de recirculacion del A1 latam, con el MISMO criterio que el gate:
 *  clave = surface (o word) en minusculas sin articulo inicial, y se cuenta en
 *  cuantos CUERPOS aparece como token suelto. Solo lectura. */
import * as fs from "fs";
const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8")) as any[];
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
const cuerpos = stories.map((s) => new Set(tok(s.text)));
const enc: Array<{ k: string; n: number; de: string }> = [];
for (const s of stories) for (const v of s.vocab)
  enc.push({ k: clave(v), n: cuerpos.filter((c) => c.has(clave(v))).length, de: `${s.topic}#${s.slotIndex}` });
const media = enc.reduce((a, b) => a + b.n, 0) / enc.length;
const multi = enc.filter((e) => /\s/.test(e.k));
console.log(`media ${media.toFixed(2)} (liston 2.5) · total ${enc.reduce((a,b)=>a+b.n,0)} encuentros / ${enc.length} plazas`);
console.log(`multipalabra ${multi.length} plazas (siempre 0) · una sola vez ${enc.filter((e)=>e.n<=1).length}`);
if (process.argv.includes("--por-historia")) {
  const todas = enc.map((e) => e.k);
  stories.forEach((s, i) => {
    const presentes = [...new Set(todas.filter((k) => !/\s/.test(k) && cuerpos[i].has(k)))];
    console.log(`  ${String(s.topic + "#" + s.slotIndex).padEnd(24)} ${String(presentes.length).padStart(3)} superficies enseñadas presentes`);
  });
}
if (process.argv.includes("--flojas")) {
  const solo = enc.filter((e) => e.n <= 1 && !/\s/.test(e.k)).map((e) => `${e.k}(${e.de})`);
  console.log(`\nUNA SOLA VEZ (${solo.length}):\n${solo.join(" | ")}`);
}
