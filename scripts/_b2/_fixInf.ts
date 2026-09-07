import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const fix: Array<[string, string, string]> = [
    ["el-telefono-boca-abajo", "entallar", "to take in a garment (entallar)"],
    ["una-yapa-para-cerrar", "regatear", "to haggle (regatear)"],
  ];
  for (const [slug, w, g] of fix) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug } } });
    const gl = fila!.glosses as Record<string, any>;
    gl[w] = { ...gl[w], g };
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug } }, data: { glosses: gl } });
    console.log(slug, w, "->", g);
  }
  await p.$disconnect();
})();
