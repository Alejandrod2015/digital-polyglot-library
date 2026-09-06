import { subjuntivoPresenteES } from "../glossMoods";
const C: Record<string, string[]> = {
  encender: ["encienda","enciendas","encienda","encendamos","encendáis","enciendan"],
  pensar: ["piense","pienses","piense","pensemos","penséis","piensen"],
  empezar: ["empiece","empieces","empiece","empecemos","empecéis","empiecen"],
  contar: ["cuente","cuentes","cuente","contemos","contéis","cuenten"],
  volver: ["vuelva","vuelvas","vuelva","volvamos","volváis","vuelvan"],
  dormir: ["duerma","duermas","duerma","durmamos","durmáis","duerman"],
  pedir: ["pida","pidas","pida","pidamos","pidáis","pidan"],
  hablar: ["hable","hables","hable","hablemos","habléis","hablen"],
  faltar: ["falte","faltes","falte","faltemos","faltéis","falten"],
  jugar: ["juegue","juegues","juegue","juguemos","juguéis","jueguen"],
};
let mal = 0;
for (const [v, esp] of Object.entries(C)) {
  const g = subjuntivoPresenteES(v);
  if (JSON.stringify(g) !== JSON.stringify(esp)) { mal++; console.log(`  MAL ${v}: ${JSON.stringify(g)}`); }
}
console.log(mal ? `${mal} mal de ${Object.keys(C).length}` : `los ${Object.keys(C).length} bien`);
