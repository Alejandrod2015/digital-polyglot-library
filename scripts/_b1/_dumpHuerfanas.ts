import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const capas = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-spain-b1" } });
  const global = capas.find((c) => c.slug === "")!.glosses as any;
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi" },
    select: { slug: true, title: true, text: true, vocab: true },
  });
  for (const s of ss) {
    const capa = { ...global, ...((capas.find((c) => c.slug === s.slug)?.glosses ?? {}) as any) };
    const cuerpo = `${s.title}. ${s.text}`;
    console.log(`\n### ${s.slug}`);
    for (const v of (s.vocab as any[])) {
      const lema = String(v.word).trim().toLowerCase();
      const sup = String(v.surface ?? "").trim().toLowerCase();
      const hit = [sup, lema].filter(Boolean).map((k) => capa[k]).find((g) => g?.c);
      if (hit) continue;
      // la oracion donde cae, para poder escribir el trozo
      const clave = sup || lema;
      const frase = cuerpo.split(/(?<=[.?!])\s+/).find((o) => o.toLowerCase().includes(clave.split(" ")[0])) ?? "";
      console.log(`- ${v.type.padEnd(10)} ${lema}${sup ? ` (sup ${sup})` : ""}`);
      console.log(`    def: ${v.definition}`);
      console.log(`    en el texto: ${frase.trim()}`);
    }
  }
  await p.$disconnect();
})();
