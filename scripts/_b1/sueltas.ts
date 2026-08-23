/** Por cuerpo: palabras de contenido que NO son clave de nadie. Candidatas a
 *  cambiarse por una clave del journey sin tocar el sentido. */
import * as fs from "fs";
const S = JSON.parse(fs.readFileSync("scripts/_b1/data/all.json", "utf8"));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}{4,}/gu) ?? []);
const claves = new Set<string>();
for (const s of S) for (const v of s.vocab) claves.add(String(v.surface ?? v.word).toLowerCase());
const VAC = new Set(("para pero como cuando donde este esta esto esos esas aquel aquella cada otro otra otros otras dos tres cuatro cinco seis siete ocho nueve diez doce veinte treinta ella ellos ellas usted aqui allí ahora luego después antes también tampoco porque aunque pues está están era eran fueron había hemos tiene tienen sale salen sube suben baja bajan pone ponen dice dicen hace hacen queda quedan mira miran lleva llevan viene vienen sabe saben puede pueden quiere hasta desde entre sobre nada nadie algo alguien todo toda todos todas mismo misma solo sola cosa cosas vez veces bien casa gente noche mañana tarde manos mano cara agua puerta calle mesa voz papel tiempo lugar nombre hora horas semana mes meses siempre nunca ninguna ningún ninguno mucho mucha muchos muchas poco poca años enero agosto marzo mayo junio abril julio noviembre octubre febrero irene rocío quique rosa marta nico julián madrid málaga nerja").split(" "));
const solo = process.argv[2];
for (const s of S) {
  const id = `${s.topic}#${s.slotIndex}`;
  if (solo && !id.startsWith(solo)) continue;
  const c = [...new Set(tok(s.text))].filter((w) => !claves.has(w) && !VAC.has(w));
  const n = [...new Set(tok(s.text))].filter((w) => claves.has(w)).length;
  console.log(`\n${id}  ${n} claves · sueltas: ${c.join(" ")}`);
}
