/** ¿Cuántas plazas PORTABLES (palabra que sale en 2+ historias) puede tener
 *  cada historia con el texto actual? Decide si el 12/8 es alcanzable sin
 *  reescribir los cuerpos. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
import { readFileSync } from "fs";
const p = new PrismaClient();
const FUNC = new Set("para com que uma sem mais dois esse essa esta aqui todos todo cada quase nada muito bem ainda depois ela ele dela dele isso outra outro eles deles assim como quando onde quem qual está estão tem então porque também sobre entre pelo pela numa num nas nos das dos ali mesmo mesma pra por uns umas seu sua meu minha aquele aquela aquilo esse essa nem lhe".split(" "));
async function main() {
  const stories = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const otras = await p.journeyStory.findMany({ where: { journey: { language: "portuguese" }, journeyId: { not: "cmsyrge55000732u9oiu8wue3" } }, select: { vocab: true } });
  const fuera = new Set<string>();
  for (const r of otras) for (const v of ((r.vocab as any[]) ?? [])) fuera.add(String(v.word).toLowerCase());
  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = stories.map((s: any) => new Set(tok(s.text)));
  const enc = (w: string) => cuerpos.filter((c: Set<string>) => c.has(w)).length;
  let total = 0;
  for (const [i, s] of stories.entries()) {
    const cand = [...new Set(tok(s.text))]
      .filter((w) => w.length > 2 && !FUNC.has(w) && !fuera.has(w) && isPortugueseA1A2(w) && enc(w) >= 2);
    total += Math.min(12, cand.length);
    console.log(`${s.topic}#${s.slotIndex}: ${cand.length} portables posibles ${cand.length < 12 ? "  <-- menos de 12" : ""}`);
  }
  console.log(`\nmedia de portables alcanzables: ${(total / stories.length).toFixed(1)} (la regla pide 12)`);
  await p.$disconnect();
}
main();
