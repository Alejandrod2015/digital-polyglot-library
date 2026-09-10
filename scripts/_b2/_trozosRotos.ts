/** Claves de las filas por historia del B2 latam cuyo trozo de contexto (c.es)
 *  ya no esta en el texto de la base: npx tsx scripts/_b2/_trozosRotos.ts [slug...] */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const solo = new Set(process.argv.slice(2));
  const hs = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" }, select: { slug: true, text: true } });
  let n = 0;
  for (const h of hs) {
    if (solo.size && !solo.has(h.slug)) continue;
    const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: h.slug } } });
    for (const [k, v] of Object.entries((f?.glosses ?? {}) as Record<string, any>)) {
      const es = v?.c?.es; if (!es) continue;
      if (!h.text.toLowerCase().includes(String(es).toLowerCase())) { console.log(`${h.slug} · ${k}: "${es}"`); n++; }
    }
  }
  console.log(`rotos: ${n}`);
  await p.$disconnect();
})();
