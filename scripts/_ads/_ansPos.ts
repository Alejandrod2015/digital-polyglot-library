/** Solo LECTURA: en cuantos ejercicios Meaning la respuesta es la PRIMERA opcion. */
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const sets = await p.storyPracticeSet.findMany({ select: { exercises: { select: { type: true, payload: true } } } });
  const pos = [0, 0, 0, 0]; let total = 0;
  for (const s of sets) for (const e of s.exercises) {
    if (e.type !== "meaning_in_context") continue;
    const pay = e.payload as { options?: string[]; answer?: string };
    if (!pay.options || !pay.answer) continue;
    const i = pay.options.indexOf(pay.answer);
    if (i < 0) continue;
    pos[i]++; total++;
  }
  console.log("Meaning:", total, "| respuesta en posicion 1/2/3/4:", pos.map((n) => `${n} (${Math.round((n / total) * 100)}%)`).join("  "));
  await p.$disconnect();
})();
