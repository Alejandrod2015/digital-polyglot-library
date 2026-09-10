/** Coste de reescribir: por historia, palabras del cuerpo, plazas de vocab y entradas de capa de glosa. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmtplpfum0007j8c6piegwt31" }, select: { slug: true, text: true, vocab: true } });
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let pal = 0, plazas = 0, capa = 0, conC = 0;
  for (const s of st) {
    pal += (s.text ?? "").trim().split(/\s+/).length;
    plazas += ((s.vocab as any[]) ?? []).length;
    const g = (filas.find((f) => f.slug === s.slug)?.glosses ?? {}) as Record<string, any>;
    capa += Object.keys(g).length;
    conC += Object.values(g).filter((e: any) => e?.c).length;
  }
  const global = Object.keys((filas.find((f) => f.slug === "")?.glosses ?? {}) as object).length;
  console.log(`historias ${st.length} · palabras ${pal} (media ${Math.round(pal / st.length)}) · plazas vocab ${plazas}`);
  console.log(`capa por historia: ${capa} entradas (${conC} con trozo de contexto) · media ${Math.round(capa / st.length)}/historia · global del bundle ${global}`);
  await p.$disconnect();
})();
