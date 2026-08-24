/**
 * Audita los fill_blank de un journey: un distractor que no concuerda en
 * genero o numero con la respuesta la regala sin leer la frase.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const term = (w: string) => {
  const x = w.toLowerCase().replace(/^(el|la|los|las|un|una)\s+/, "");
  if (/(as|es|os)$/.test(x)) return x.slice(-2);
  if (/s$/.test(x)) return "s";
  if (/a$/.test(x)) return "a";
  if (/o$/.test(x)) return "o";
  return "-";
};
(async () => {
  const rows = await p.storyPracticeExercise.findMany({
    where: { type: "fill_blank", set: { story: { journeyId: process.argv[2] } } },
    select: { word: true, payload: true, sentence: true, set: { select: { story: { select: { slug: true } } } } },
  });
  const malos: string[] = [];
  for (const r of rows) {
    const pl = r.payload as { options?: string[]; answer?: string };
    const ans = String(pl.answer ?? r.word);
    const otros = (pl.options ?? []).filter((o) => o !== ans);
    if (!otros.length) continue;
    const t = term(ans);
    if (t !== "-" && otros.every((o) => term(o) !== t))
      malos.push(`${r.set.story.slug}  ${ans} vs ${otros.join(", ")}`);
  }
  console.log(`${rows.length} fill_blank · ${malos.length} se regalan por concordancia (${Math.round(100*malos.length/rows.length)}%)`);
  for (const m of malos.slice(0, 12)) console.log("  " + m);
})().finally(() => p.$disconnect());
