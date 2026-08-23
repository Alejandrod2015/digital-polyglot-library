/** Vuelca ejercicios del A1 latam para leerlos como los lee el alumno. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
(async () => {
  const tipo = process.argv[2] ?? "fill_blank";
  const n = Number(process.argv[3] ?? 6);
  const st = await p.journeyStory.findMany({ where: { journeyId: A1 },
    select: { slug: true, practiceSet: { select: { exercises: {
      select: { type: true, sentence: true, payload: true }, orderBy: { orderIndex: "asc" } } } } } });
  let vistos = 0;
  for (const s of st) for (const e of s.practiceSet?.exercises ?? []) {
    if (e.type !== tipo || vistos >= n) continue;
    vistos++;
    const pay = e.payload as any;
    console.log(`\n[${s.slug}]`);
    console.log(`  ${pay.prompt ?? ""}`);
    if (e.sentence) console.log(`  ${e.sentence}`);
    if (pay.options) console.log(`  opciones: ${pay.options.join("  |  ")}`);
    if (pay.answer) console.log(`  respuesta: ${pay.answer}`);
    if (pay.pairs) for (const par of pay.pairs) console.log(`  ${par.word} -> ${par.answer}   [${par.options.join(" / ")}]`);
  }
  await p.$disconnect();
})();
