import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2", S = "la-guasa-del-domingo";
(async () => {
  const st = await p.journeyStory.findFirst({ where: { slug: S }, select: { text: true, vocab: true } });
  for (const v of (st!.vocab as any[])) if (["letra", "picarse"].includes(v.word)) console.log("vocab:", JSON.stringify(v));
  const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: S } } });
  const g = { ...(fila!.glosses as Record<string, any>) };
  console.log("antes letra:", JSON.stringify(g["letra"] ?? null), "picarse:", JSON.stringify(g["picarse"] ?? null));
  const frag = (es: string) => { if (!st!.text.toLowerCase().includes(es.toLowerCase())) throw new Error(`no subcadena: ${es}`); };
  frag("manda en las letras"); frag("se pica y lo disimula mal");
  g["letra"] = { ...(g["letra"] ?? {}), c: { es: "manda en las letras", en: "rules over the lyrics" }, g: g["letra"]?.g ?? "lyrics, the words of a song (la letra)", t: g["letra"]?.t ?? "noun" };
  g["picarse"] = { ...(g["picarse"] ?? {}), c: g["picarse"]?.c ?? { es: "se pica y lo disimula mal", en: "gets stung and hides it badly" }, g: "to get stung, to take offence (picarse)", t: g["picarse"]?.t ?? "verb" };
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: S } }, data: { glosses: g } });
  console.log("escritas");
  await p.$disconnect();
})();
