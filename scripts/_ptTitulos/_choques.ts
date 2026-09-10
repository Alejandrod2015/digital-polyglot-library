/** Los 42 slugs nuevos, y si alguno choca en journeyStory o en tapGlossSet de
 *  TODA la base antes de aplicar nada.
 *
 *  Los dos journeys de portugues comparten espacio de slug con el A0 y el A1
 *  del mismo idioma, asi que un titulo parecido puede dar un slug ya ocupado y
 *  mezclar las glosas de dos historias sin que salte ningun lint. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();
const IDS = ["cmtrcpgso00073232h8vaf7na", "cmtq5n9a50007j8812p9lzxjr"];
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

(async () => {
  const mios = new Map<string, { id: string; antes: string; titulo: string }>();
  for (const journeyId of IDS) {
    const hs = await p.journeyStory.findMany({
      where: { journeyId }, select: { id: true, slug: true, title: true },
    });
    for (const h of hs) {
      const nuevo = slugify(h.title ?? "");
      if (!nuevo || nuevo === h.slug) continue;
      if (mios.has(nuevo)) console.log(`CHOQUE INTERNO: "${nuevo}" lo piden dos historias`);
      mios.set(nuevo, { id: h.id, antes: h.slug ?? "", titulo: h.title ?? "" });
    }
  }
  const nuevos = [...mios.keys()];
  const viejos = new Set([...mios.values()].map((v) => v.antes));

  const hist = await p.journeyStory.findMany({
    where: { slug: { in: nuevos } }, select: { slug: true, journeyId: true, title: true },
  });
  for (const h of hist) {
    if (mios.get(h.slug!)?.id === undefined) continue;
    console.log(`CHOQUE journeyStory: "${h.slug}" ya es de "${h.title}" (journey ${h.journeyId})`);
  }
  const glos = await p.tapGlossSet.findMany({ where: { slug: { in: nuevos } }, select: { bundle: true, slug: true } });
  for (const g of glos) if (!viejos.has(g.slug)) console.log(`CHOQUE tapGlossSet: "${g.slug}" ya existe en ${g.bundle}`);

  console.log(`\n${nuevos.length} slugs a cambiar · ${hist.length} choques en historias · ${glos.filter((g) => !viejos.has(g.slug)).length} en glosas`);
  for (const [nuevo, v] of mios) console.log(`  ${v.antes}  ->  ${nuevo}`);
  await p.$disconnect();
})();
