/** Crea/actualiza la fila global del bundle del B2 latam. Vacia al nacer: la
 *  rellena `rebuildTapGlosses.ts` desde los hermanos y lo que falte va a mano.
 *  Se re-corre tras cada tema para actualizar `slugs`. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmtpls1l20007j8epwgcs6e1h", slug: { not: null } }, select: { slug: true }, orderBy: { slug: "asc" } });
  const slugs = ss.map((s) => s.slug!).filter(Boolean);
  const fila = await p.tapGlossSet.upsert({
    where: { bundle_slug: { bundle: "spanish-traveler-latam-b2", slug: "" } },
    create: { bundle: "spanish-traveler-latam-b2", slug: "", slugs, glosses: {}, language: "spanish", variant: "latam" },
    update: { slugs },
    select: { bundle: true, slugs: true },
  });
  console.log(fila.bundle, "->", fila.slugs.join(", "));
  await p.$disconnect();
})();
