// Solo lectura: lo que daria journey-vocab-worth-teaching en PT si el "lexico graduado"
// fuera la union de las listas PT que existen (A1/A2 y B1). Media de plazas fuera por historia,
// con el mismo trato que el check de ES (expresiones fuera, prueba sin plural).
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
import { isPortugueseB1Lemma } from "../src/lib/cefr/portugueseB1";
const p = new PrismaClient();
const dentro = (w: string) => isPortugueseA1A2(w) || isPortugueseB1Lemma(w);
const fuera = (w: string) => {
  const x = w.trim().toLowerCase();
  if (!x || x.includes(" ")) return false;
  const f = [x]; if (x.endsWith("es") && x.length > 4) f.push(x.slice(0, -2)); if (x.endsWith("s") && x.length > 3) f.push(x.slice(0, -1));
  return !f.some(dentro);
};
async function mide(nombre: string, historias: Array<{ vocab: any }>) {
  const por = historias.map((h) => (h.vocab as any[] ?? []).map((v) => ({ w: String(v.word), a: !!v.anchor })).filter((v) => fuera(v.w)));
  const tot = por.reduce((n, x) => n + x.length, 0);
  const sinAnc = por.reduce((n, x) => n + x.filter((v) => !v.a).length, 0);
  console.log(`${nombre}: ${historias.length} historias · media ${(tot / historias.length).toFixed(2)} fuera por historia · sin contar ancladas ${(sinAnc / historias.length).toFixed(2)} · ej: ${por.flat().slice(0, 12).map((v) => v.w).join(", ")}`);
}
async function main() {
  for (const [id, n] of [["cmsou2uk0000732mqa4oatcmn", "PT a1 live (antiguo A0)"], ["cmsyrge55000732u9oiu8wue3", "PT a2 live (antiguo A1)"]] as const)
    await mide(n, (await p.journeyStory.findMany({ where: { journeyId: id }, select: { vocab: true } })));
  const a0 = (await p.journeyStory.findMany({ where: { journeyId: "cmtvpqsfv000832hgemzk20cl", NOT: { topic: "bonito" } }, select: { vocab: true } })).filter((r) => r.vocab);
  const t7 = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  await mide("PT a0 nuevo (18 guardadas + tema 7)", [...a0, ...t7]);
}
main().finally(() => p.$disconnect());
