import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { presente } from "../buildGlossForms";
const p = new PrismaClient();
// Verbos que diptongan (e->ie, o->ue, e->i). Si `presente` no diptonga, la tabla
// entera que se le enseña al alumno esta mal.
const DIPT = ["devolver","encender","volver","poder","dormir","contar","costar","recordar","mover","llover",
  "querer","pensar","empezar","cerrar","perder","entender","sentir","preferir","despertar","calentar",
  "pedir","servir","seguir","repetir","vestir","medir","jugar","probar","soltar","colgar","rogar","sonar","soñar","doler","morder","oler"];
(async () => {
  const rotas = DIPT.filter((v) => { const pr = presente(v, "spain"); return pr && !/[ií]e|ue|(^|[^a-z])(pid|sirv|sig|rep[ií]t|vist|mid)/.test(pr[2]); });
  console.log(`verbos que diptongan mal en presente(): ${rotas.length} de ${DIPT.length}`);
  console.log("  " + rotas.map((v) => `${v} -> ${presente(v, "spain")![2]}`).join(" · "));
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" }, bundle: { startsWith: "spanish-" } }, select: { bundle: true, glosses: true } });
  let afectadas = 0; const donde = new Map<string, number>();
  for (const f of filas) for (const e of Object.values(f.glosses as Record<string, any>)) {
    const lem = String(e.f?.lemma ?? "").split(" ")[0].replace(/^(se|me|te|lo|la|le)\s+/, "");
    if (rotas.some((v) => lem === v || lem.endsWith(v))) { afectadas++; donde.set(f.bundle, (donde.get(f.bundle) ?? 0) + 1); }
  }
  console.log(`\ntablas con uno de esos verbos: ${afectadas}`);
  console.log([...donde].sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b} ${n}`).join(" · "));
  await p.$disconnect();
})();
