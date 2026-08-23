/** Reparte las portables por los 21 cuerpos: cada palabra se siembra en TRES
 *  historias (i, i+7, i+14) para que las reapariciones crucen los temas, y
 *  ocupa plaza en DOS de esas tres. Escribe la tabla de siembra. */
import * as fs from "fs";
const ok: string[] = JSON.parse(fs.readFileSync("" + __dirname + "/portables-ok.json","utf8"))
  .filter((w:string)=>w!=="der Sofort" && w!=="der Semester");
const N = 21;
const siembra: string[][] = Array.from({length:N},()=>[]);
const plaza: string[][] = Array.from({length:N},()=>[]);
ok.forEach((w:string, idx:number)=>{
  const a = idx % N, b = (a+7)%N, c = (a+14)%N;
  for (const i of [a,b,c]) siembra[i].push(w);
  // plaza en dos de las tres, alternando cual se queda fuera
  const fuera = [a,b,c][idx % 3];
  for (const i of [a,b,c]) if (i!==fuera) plaza[i].push(w);
});
const titulos = JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8")).map((s:any)=>s.title);
let out = "# Siembra de portables por historia\n\n";
for (let i=0;i<N;i++){
  out += `## ${i+1}. ${titulos[i]}\n`;
  out += `- sembrar (deben APARECER en el cuerpo): ${siembra[i].join(", ")}\n`;
  out += `- plazas portables aqui (${plaza[i].length}): ${plaza[i].join(", ")}\n`;
  out += `- faltan ${20-plaza[i].length} plazas ancladas de escena\n\n`;
}
fs.writeFileSync("docs/de-a0-traveler-siembra.md", out);
console.log(`portables ${ok.length} · siembras ${siembra.reduce((a,b)=>a+b.length,0)} · plazas portables ${plaza.reduce((a,b)=>a+b.length,0)}`);
console.log("por historia, sembradas:", siembra.map(s=>s.length).join(" "));
console.log("por historia, plazas portables:", plaza.map(s=>s.length).join(" "));
