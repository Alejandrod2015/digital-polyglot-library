/** Glosas con el sentido de SU frase (fila de la historia; la global no se toca). Uso: <fixes.json> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { readFileSync } from "fs";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
(async () => {
  const fx = JSON.parse(readFileSync(process.argv[2], "utf8")) as Record<string, Record<string, string>>;
  for (const [slug, m] of Object.entries(fx)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...(fila!.glosses as Record<string, any>) };
    for (const [k, gl] of Object.entries(m)) { if (!g[k]?.c) throw new Error(`${slug}/${k}: sin trozo`); g[k] = { ...g[k], g: gl }; }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
    console.log(`${slug}: ${Object.keys(m).join(", ")}`);
  }
  await p.$disconnect();
})();
