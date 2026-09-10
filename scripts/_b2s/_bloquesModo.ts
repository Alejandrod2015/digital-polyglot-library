import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
const Q: Record<string, string[]> = { "la-bolsa-como-prueba": ["guarden", "eligieran"], "la-sobremesa-se-estira": ["costara", "quedara", "tendría"] };
(async () => {
  for (const [slug, ks] of Object.entries(Q)) {
    const g = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } }))!.glosses as Record<string, any>;
    for (const k of ks) console.log(`${slug} · ${k}\n  g: ${g[k]?.g}\n  f: ${JSON.stringify(g[k]?.f)}\n`);
  }
  await p.$disconnect();
})();
