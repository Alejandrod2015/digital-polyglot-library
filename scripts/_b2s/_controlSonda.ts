/** Frases de control con resultado conocido contra la sonda REAL (importa `mide`). */
import { mide } from "../_gramProbe";
const CASOS: Array<[string, string, number]> = [
  ["pretérito", "Claudia llegó a Cádiz y pidió las llaves.", 2],
  ["pretérito", "La canción suena cómo siempre en la habitación.", 0],
  ["estilo indirecto", "La frutera me preguntó ayer si volvería.", 1],
  ["estilo indirecto", "Nadie le había pedido que se quedara.", 1],
  ["estilo indirecto", "“Hola”, dijo Marcos, que no tenía prisa.", 0],
  ["subj. imperfecto", "Ensayó la frase para que nadie la oyera en cualquier clase.", 1],
  ["subj. imperfecto", "Que me guarden lo que quieran.", 0],
  ["subj. imperfecto", "Le encargó que digitalizara el archivo antes de que pasara el verano.", 2],
  ["subj. imperfecto", "Ni siquiera la cuchara, la cáscara o la cámara; Javiera prepara la cena.", 0],
  ["subj. imperfecto", "Pasen, pasen: que pase quien quiera, dijo Javiera sin que nadie separara las sillas.", 1],
  ["subj. presente", "Que me guarden lo que quieran.", 1],
  ["condicional", "Querían saber si se aburría en la panadería.", 0],
  ["condicional", "Le habría gustado, y mañana preguntaría; me tendría que ir.", 3],
  ["conectores", "Llovía, así que se quedó.", 1],
];
let mal = 0;
for (const [fila, frase, esperado] of CASOS) {
  const { tokens } = mide(frase);
  const sale = tokens[fila].length;
  if (sale !== esperado) mal++;
  console.log(`${sale === esperado ? "OK  " : "MAL "} ${fila.padEnd(17)} esperado ${esperado} · sale ${sale} ${JSON.stringify(tokens[fila])}`);
}
console.log(mal ? `\n${mal} caso(s) MAL` : "\ntodos los casos de control OK");
