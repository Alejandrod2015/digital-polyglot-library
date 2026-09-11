/** "solo/sola" reflexivo (se + verbo + solo/sola = "by itself"), no "only, alone":
 *  cuatro historias del B2 latam. Solo toca g/t de la fila de esa historia. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const FIX: Array<[string, string, string, string]> = [
  ["la-cortesia-mas-cara", "solo", "by itself, on its own; not only/alone here", "adverb"],
  ["de-medio-metro-y-gracias", "solo", "by itself, on its own; not only/alone here", "adverb"],
  ["la-ultima-dorada", "sola", "by itself, on its own; not alone here", "adjective"],
  ["la-carreta-mojada", "sola", "by itself, on its own; not alone here", "adjective"],
];
(async () => {
  for (const [slug, key, g, t] of FIX) {
    const row = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug } } });
    const glosses = { ...(row!.glosses as Record<string, any>) };
    if (!glosses[key]?.c) throw new Error(`${slug}/${key}: sin c, no toco`);
    glosses[key] = { ...glosses[key], g, t };
    await p.tapGlossSet.update({ where: { id: row!.id }, data: { glosses } });
    console.log(`${slug} · ${key}: g -> "${g}"`);
  }
  await p.$disconnect();
})();
