/**
 * Que palabras del pool RINDEN mas como plaza: en cuantos de los 21 cuerpos
 * aparecen ya. Una plaza puesta en una palabra que sale en 8 cuerpos vale 8
 * encuentros; en una que sale en 1, vale 1.
 */
import * as fs from "fs";
const pool = new Set(fs.readFileSync("scripts/_b1/pool-limpio.txt", "utf8").split(/\r?\n/).filter(Boolean));
const S = JSON.parse(fs.readFileSync("scripts/_b1/data/all.json", "utf8"));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const cuerpos = S.map((s: any) => ({ id: `${s.topic}#${s.slotIndex}`, set: new Set(tok(s.text)) }));
const yaClave = new Set<string>();
for (const s of S) for (const v of s.vocab) yaClave.add(String(v.surface ?? v.word).toLowerCase());
const VACIAS = new Set(("la el los las un una unos unas y o e ni que de del a al en con por para sin sobre entre hasta desde tras se le les lo me te nos su sus mi mis tu tus no ya si más menos muy todo toda todos todas nada nadie algo alguien esto esta este estos estas eso esa ese esos esas aquel aquella cada otro otra otros otras dos tres cuatro cinco seis siete ocho nueve diez veinte treinta yo tú él ella ellos ellas usted aquí allí ahora luego después antes también tampoco porque aunque pero pues cuando donde como qué quién cuál cuánto ser estar haber tener hacer ir ver dar decir poder querer saber está están era eran fue fueron hay había son es sea sido bien mal así solo sólo cosa cosas vez veces día días año años casa gente hombre mujer noche mañana tarde manos mano cara agua puerta calle mesa voz papel tiempo lugar nombre hora horas semana mes meses").split(" "));
const cuenta = new Map<string, string[]>();
for (const c of cuerpos) for (const w of c.set) {
  if (!pool.has(w) || yaClave.has(w) || VACIAS.has(w) || w.length < 4) continue;
  cuenta.set(w, [...(cuenta.get(w) ?? []), c.id]);
}
const ord = [...cuenta].filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length);
console.log(`${ord.length} palabras del pool que ya salen en 2+ cuerpos y NO son plaza todavia:\n`);
for (const [w, ids] of ord) console.log(`  ${String(ids.length).padStart(2)}  ${w.padEnd(16)} ${ids.slice(0,6).join(" ")}`);
