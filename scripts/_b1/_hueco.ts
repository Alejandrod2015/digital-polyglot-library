/** Cuanto pierde el vocab frente a la glosa, medido sobre las 60 plazas. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-spain-b1" } });
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi" },
    select: { slug: true, title: true, text: true, vocab: true },
  });
  let tot = 0, conCtx = 0, conFormas = 0, sinNada: string[] = [];
  for (const s of ss) {
    const capa = { ...(filas.find((f) => f.slug === "")!.glosses as any), ...((filas.find((f) => f.slug === s.slug)?.glosses ?? {}) as any) };
    const texto = `${s.title} ${s.text}`.toLowerCase();
    for (const v of (s.vocab as any[])) {
      tot++;
      const lema = String(v.word).trim().toLowerCase();
      // la superficie: la forma del lema que de verdad sale en el texto
      const sup = (texto.match(new RegExp(`\\b${lema.slice(0, Math.max(4, lema.length - 3))}[\\p{L}]*`, "u")) ?? [])[0];
      const hit = [sup, lema].filter(Boolean).map((x) => capa[x!]).find((h) => h?.c);
      if (hit?.c) conCtx++; else sinNada.push(`${s.slug.slice(0, 12)}:${lema}`);
      if (hit?.f) conFormas++;
    }
  }
  console.log(`plazas ${tot} · con frase de contexto ${conCtx} · con tabla de formas ${conFormas}`);
  console.log(`sin contexto (${sinNada.length}): ${sinNada.slice(0, 14).join(" ")}`);
  await p.$disconnect();
})();
