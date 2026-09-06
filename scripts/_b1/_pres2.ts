import { presente } from "../buildGlossForms";
const CASOS: Record<string, string[]> = {
  pensar: ["pienso","piensas","piensa","pensamos","pensáis","piensan"],
  servir: ["sirvo","sirves","sirve","servimos","servís","sirven"],
  oler: ["huelo","hueles","huele","olemos","oléis","huelen"],
  jugar: ["juego","juegas","juega","jugamos","jugáis","juegan"],
  soltar: ["suelto","sueltas","suelta","soltamos","soltáis","sueltan"],
  seguir: ["sigo","sigues","sigue","seguimos","seguís","siguen"],
  dormir: ["duermo","duermes","duerme","dormimos","dormís","duermen"],
  querer: ["quiero","quieres","quiere","queremos","queréis","quieren"],
  hablar: ["hablo","hablas","habla","hablamos","habláis","hablan"],
};
let mal = 0;
for (const [v, esperado] of Object.entries(CASOS)) {
  const got = presente(v, "spain");
  const ok = JSON.stringify(got) === JSON.stringify(esperado);
  if (!ok) { mal++; console.log(`  MAL ${v}: ${JSON.stringify(got)}`); }
}
console.log(mal === 0 ? `los ${Object.keys(CASOS).length} casos salen bien` : `${mal} mal`);
