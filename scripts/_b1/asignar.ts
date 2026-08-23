/**
 * Reparte las 444 plazas entre las 21 historias eligiendo, para cada una, las
 * palabras del pool que MAS cuerpos del journey tocan y que estan en su propio
 * cuerpo. Respeta: una palabra una sola vez en el journey, y nunca dos plazas
 * de la misma historia con la misma raiz de 5 letras.
 */
import * as fs from "fs";
const S = JSON.parse(fs.readFileSync("scripts/_b1/data/all.json", "utf8"));
const pool = new Set(fs.readFileSync("scripts/_b1/pool-limpio.txt", "utf8").split(/\r?\n/).filter(Boolean));
const tok = (t: string) => (t.toLowerCase().match(/\p{L}{3,}/gu) ?? []);
const cuerpos: Array<Set<string>> = S.map((s: any) => new Set(tok(s.text)));
const cuenta = new Map<string, number>();
for (const c of cuerpos) for (const w of c) if (pool.has(w)) cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
// Palabras que NO merecen plaza aunque esten en las listas CEFR: gramaticales,
// deicticos, numerales, meses, nombres propios y verbos de andar por casa. Sin
// este filtro el reparto optimo elige "que", "con" y "una", que es exactamente
// el teatro que la escalera no debe premiar.
const NO_PLAZA = new Set(("sin por sobre entre hasta desde ante tras segun contra hacia dentro fuera arriba abajo detras delante encima debajo cerca lejos luego antes despues ahora entonces asi aqui alli ademas tambien tampoco quiza acaso apenas incluso salvo excepto que con una uno unos unas los las del para pero como cuando donde este esta esto estos estas esos esas aquel aquella aquellos otro otra otros otras mismo misma solo sola sino aunque pues porque mientras siempre nunca jamas casi bastante mucho mucha muchos muchas poco poca pocos pocas todo toda todos todas nada nadie algo alguien ninguno ninguna ningun cada mas menos muy tanto tan ella ellos ellas usted nosotros vosotros suya suyo mia mio tuya tuyo dos tres cuatro cinco seis siete ocho nueve diez once doce quince veinte treinta cien mil primero segundo tercero enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre lunes martes miercoles jueves viernes sabado domingo dia dias año años noche mañana tarde hora horas semana mes meses vez veces cosa cosas gente casa calle puerta mesa mano manos cara voz agua tiempo lugar nombre sitio hacer hace hacen dice dicen decir sale salen sube suben baja bajan pone ponen queda quedan mira miran lleva llevan viene vienen sabe saben puede pueden quiere entra entran deja dejan saca sacan tiene tienen esta estan era eran fue fueron habia hay bien mal mejor peor mucho final pase abre abren llega llegan sigue siguen paso pasa pasan").split(" "));
const raiz = (w: string) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 5);

const tomadas = new Set<string>();
const asign: string[][] = S.map(() => []);
// Ronda a ronda: en cada vuelta cada historia coge su mejor candidata libre.
for (let ronda = 0; ronda < 25; ronda++) {
  const orden = [...S.keys()].sort((a, b) => asign[a].length - asign[b].length);
  for (const i of orden) {
    if (asign[i].length >= 21) continue;
    const raices = new Set(asign[i].map(raiz));
    const cand = [...cuerpos[i]]
      .filter((w) => pool.has(w) && !NO_PLAZA.has(w.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) && !tomadas.has(w) && !raices.has(raiz(w)))
      .sort((a, b) => (cuenta.get(b)! - cuenta.get(a)!) || a.localeCompare(b));
    if (!cand.length) continue;
    asign[i].push(cand[0]); tomadas.add(cand[0]);
  }
}
let suma = 0, plazas = 0;
for (const [i, s] of S.entries()) {
  const v = asign[i].map((w) => cuenta.get(w)!);
  suma += v.reduce((a, b) => a + b, 0); plazas += v.length;
  console.log(`${String(s.topic + "#" + s.slotIndex).padEnd(30)} ${String(v.length).padStart(2)} plazas · media ${(v.reduce((a,b)=>a+b,0)/v.length).toFixed(2)}`);
}
console.log(`\nescalera con este reparto: ${(suma / plazas).toFixed(2)} sobre ${plazas} plazas`);
fs.writeFileSync("scripts/_b1/asignacion.json", JSON.stringify(S.map((s: any, i: number) => ({ id: `${s.topic}#${s.slotIndex}`, palabras: asign[i].map((w) => ({ w, n: cuenta.get(w) })) })), null, 1));
