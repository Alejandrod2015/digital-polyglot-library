/** Comprueba que dentro de los 10 DESTACADOS de cada historia no se repite la
 *  misma oracion ni la misma palabra (el solape featured/pool si es de diseño). */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
const norm = (s: string) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/_+/g, "_").trim();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: A1 },
    select: { slug: true, practiceSet: { select: { exercises: {
      select: { featured: true, type: true, word: true, sentence: true }, orderBy: { orderIndex: "asc" } } } } } });
  let malas = 0;
  for (const s of st) {
    const f = (s.practiceSet?.exercises ?? []).filter((e) => e.featured);
    const frases = new Map<string, number>(); const palabras = new Map<string, number>();
    for (const e of f) {
      if (e.sentence) frases.set(norm(e.sentence), (frases.get(norm(e.sentence)) ?? 0) + 1);
      palabras.set(norm(e.word), (palabras.get(norm(e.word)) ?? 0) + 1);
    }
    const fr = [...frases].filter(([, n]) => n > 1);
    const pa = [...palabras].filter(([, n]) => n > 1);
    if (f.length !== 10 || fr.length || pa.length) {
      malas++;
      console.log(`${s.slug}: ${f.length} destacados` +
        (fr.length ? ` · frase repetida: ${fr.map(([k, n]) => `"${k.slice(0, 40)}" x${n}`).join(", ")}` : "") +
        (pa.length ? ` · palabra repetida: ${pa.map(([k, n]) => `${k} x${n}`).join(", ")}` : ""));
    }
  }
  console.log(malas === 0 ? "\nlos 21 destacados: 10 ejercicios, sin frase ni palabra repetida" : `\n${malas} historias con problema`);
  await p.$disconnect();
})();
// --detalle <slug>: los 10 destacados de una historia, para leerlos.
