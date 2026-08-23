/** Reparto real: cada palabra portable solo puede ser plaza en UNA historia. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { isPortugueseA1A2 } from "../src/lib/cefr/portugueseA1A2";
import { readFileSync } from "fs";
const p = new PrismaClient();
const FUNC = new Set("para com que uma sem mais dois esse essa esta aqui todos todo cada quase nada muito bem ainda depois ela ele dela dele isso outra outro eles deles assim como quando onde quem qual está estão tem então porque também sobre entre pelo pela numa num nas nos das dos ali mesmo mesma pra por uns umas seu sua meu minha aquele aquela aquilo nem lhe".split(" "));
async function main() {
  const stories = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const otras = await p.journeyStory.findMany({ where: { journey: { language: "portuguese" }, journeyId: { not: "cmsyrge55000732u9oiu8wue3" } }, select: { vocab: true } });
  const fuera = new Set<string>();
  for (const r of otras) for (const v of ((r.vocab as any[]) ?? [])) fuera.add(String(v.word).toLowerCase());
  const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
  const cuerpos = stories.map((s: any) => new Set(tok(s.text)));
  const enc = (w: string) => cuerpos.filter((c: Set<string>) => c.has(w)).length;
  const cands = stories.map((s: any) =>
    [...new Set(tok(s.text))].filter((w) => w.length > 2 && !FUNC.has(w) && !fuera.has(w) && isPortugueseA1A2(w) && enc(w) >= 2)
      .sort((a, b) => enc(b) - enc(a)));
  // Greedy: la historia con menos candidatos elige primero.
  const orden = stories.map((_: any, i: number) => i).sort((a: number, b: number) => cands[a].length - cands[b].length);
  const usadas = new Set<string>(); const asignadas: number[] = new Array(stories.length).fill(0);
  for (const i of orden) {
    for (const w of cands[i]) {
      if (asignadas[i] >= 12) break;
      if (usadas.has(w)) continue;
      usadas.add(w); asignadas[i]++;
    }
  }
  stories.forEach((s: any, i: number) => console.log(`${s.topic}#${s.slotIndex}: ${asignadas[i]} portables`));
  console.log(`\nmedia real con reparto sin repetir: ${(asignadas.reduce((a, b) => a + b, 0) / stories.length).toFixed(1)} de 12`);
  await p.$disconnect();
}
main();
