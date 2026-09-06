/** Crea la fila global del bundle del B1, que no existia. Vacia: la rellena
 *  `rebuildTapGlosses.ts` desde los hermanos y lo que falte va a mano. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi" }, select: { slug: true }, orderBy: { slug: "asc" } });
  const slugs = ss.map((s) => s.slug!).filter(Boolean);
  const fila = await p.tapGlossSet.upsert({
    where: { bundle_slug: { bundle: "spanish-traveler-spain-b1", slug: "" } },
    create: { bundle: "spanish-traveler-spain-b1", slug: "", slugs, glosses: {}, language: "spanish", variant: "spain" },
    update: { slugs },
    select: { bundle: true, slugs: true },
  });
  console.log(fila.bundle, "->", fila.slugs.join(", "));
  await p.$disconnect();
})();
