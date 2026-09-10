// Solo lectura: palabras que ya salen en el TEXTO de las historias del Traveler PT-BR A0 nuevo
// pero no son plaza de vocab en el journey, con el numero de cuerpos donde salen.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const STOP = new Set("a o as os um uma uns umas de do da dos das em no na nos nas num numa por pelo pela para com sem que se e ou mas não sim ao aos à às é são está estão ele ela eles elas eu você nós me te lhe seu sua meu minha dele dela isso isto aqui ali lá quando onde como quem qual mais menos muito pouco tudo todo toda todos todas cada outro outra também só até depois antes então porque ainda assim agora nada mesmo bem tem ter faz fazer vai ir dá dar diz fala pergunta responde larissa caio cláudia bruna camila mariana diego londres rio janeiro brasil belo horizonte fortaleza porto alegre natal são luís beagá".split(" "));
async function main() {
  const rows = (await p.journeyStory.findMany({ where: { journeyId: "cmtvpqsfv000832hgemzk20cl" }, select: { text: true, vocab: true } })).filter((r) => r.text);
  const ens = new Set<string>();
  for (const r of rows) for (const v of (r.vocab as any[])) { ens.add(String(v.word).toLowerCase()); ens.add(String(v.surface ?? "").toLowerCase()); }
  const cuenta = new Map<string, number>();
  for (const r of rows) for (const w of new Set(r.text!.toLowerCase().match(/\p{L}+/gu) ?? [])) {
    if (w.length < 3 || STOP.has(w) || ens.has(w)) continue;
    cuenta.set(w, (cuenta.get(w) ?? 0) + 1);
  }
  const l = [...cuenta].sort((a, b) => b[1] - a[1]);
  console.log(l.map(([w, n]) => `${w}:${n}`).join(" "));
}
main().finally(() => p.$disconnect());
