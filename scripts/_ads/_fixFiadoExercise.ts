/** Un solo ejercicio: "dar fiado". La pregunta es por el LEMA, asi que las
 *  cuatro opciones van en infinitivo; antes eran clausulas en primera persona
 *  y no respondian a lo que se pregunta. Solo toca options y answer. */
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const NEW = ["to lend it on trust", "to owe that much", "to charge extra", "to keep it"];
(async () => {
  const ex = await p.storyPracticeExercise.findFirst({
    where: { word: "dar fiado", type: "meaning_in_context" },
    select: { id: true, word: true, sentence: true, payload: true },
  });
  if (!ex) throw new Error("sin ejercicio");
  const pay = ex.payload as Record<string, unknown>;
  console.log("ANTES:", JSON.stringify({ options: pay.options, answer: pay.answer }));
  const next = { ...pay, options: NEW, answer: NEW[0] };
  if (process.argv.includes("--write")) {
    await p.storyPracticeExercise.update({ where: { id: ex.id }, data: { payload: next as never } });
    console.log("DESPUES:", JSON.stringify({ options: NEW, answer: NEW[0] }));
  } else {
    console.log("DRY:", JSON.stringify({ options: NEW, answer: NEW[0] }));
  }
  await p.$disconnect();
})();
