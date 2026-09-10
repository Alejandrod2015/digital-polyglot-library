/** Lista las copias sin leer (rev:false) de la fila global del bundle, y el vocab de una historia. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const B = "spanish-traveler-spain-b2";
  const g = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as Record<string, any>;
  const pend = Object.entries(g).filter(([, v]) => v?.rev === false);
  for (const [k, v] of pend) console.log(`${k}|${v.t ?? ""}|${v.g ?? ""}|${v.c?.es ?? ""}`);
  console.error(`${pend.length} copias sin leer en la fila global`);
  const s = await p.journeyStory.findFirst({ where: { slug: "un-mantel-mojado" }, select: { vocab: true } });
  console.error("apilar:", JSON.stringify((s!.vocab as any[]).find((v) => v.word === "apilar")));
  await p.$disconnect();
})();
