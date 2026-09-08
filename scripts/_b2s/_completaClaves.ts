import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
const KEYS: Record<string, string[]> = {
  "la-herramienta-seria": ["negociar", "repasar"],
  "el-cafe-lo-pones-tu": ["quedarse"],
};
(async () => {
  const global = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as Record<string, any>;
  for (const [slug, keys] of Object.entries(KEYS)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...(fila!.glosses as Record<string, any>) };
    for (const k of keys) {
      console.log(`  global[${k}]=`, JSON.stringify(global[k] ?? null));
      g[k] = { ...(global[k] ?? {}), ...g[k] };
      if (!g[k].g) throw new Error(`${slug}/${k}: sigue sin g; hay que escribirla`);
      console.log(`  ${slug} · ${k}:`, JSON.stringify(g[k]).slice(0, 140));
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
  }
  await p.$disconnect();
})();
