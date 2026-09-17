/**
 * Crea (o pone al dia) la fila global del bundle de glosas del A2 PT y le
 * cuelga las historias que YA tienen texto, en orden de lectura.
 *
 * El bundle nace VACIO de glosas a proposito: quien las escribe es
 * rebuildTapGlosses.ts, copiando de los bundles hermanos del mismo idioma, y
 * para eso `portuguese-traveler-brazil-a2` tiene que estar en su tabla
 * FAMILIES, que ya lo esta. Sin la fila el lector no tiene donde buscar y
 * cada palabra tocable sale muerta.
 *
 *   npx tsx scripts/_pta2Bundle.ts
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const J = "cmtrcpgso00073232h8vaf7na";
const BUNDLE = "portuguese-traveler-brazil-a2";
const p = new PrismaClient();

(async () => {
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  if (!j) throw new Error(`no encuentro el journey ${J}`);
  const rows = await p.journeyStory.findMany({
    where: { journeyId: J, NOT: { text: null } },
    select: { slug: true, topic: true, slotIndex: true },
  });
  rows.sort(
    (a, b) =>
      j.topics.indexOf(a.topic!) - j.topics.indexOf(b.topic!) || a.slotIndex - b.slotIndex,
  );
  const slugs = rows.map((r) => r.slug!).filter(Boolean);

  const ya = await p.tapGlossSet.findFirst({ where: { bundle: BUNDLE, slug: "" } });
  if (ya) {
    await p.tapGlossSet.update({ where: { id: ya.id }, data: { slugs } });
    console.log(`bundle ${BUNDLE} actualizado -> ${slugs.length} historias`);
  } else {
    await p.tapGlossSet.create({
      data: { bundle: BUNDLE, slug: "", language: "portuguese", variant: "brazil", slugs, glosses: {} },
    });
    console.log(`bundle ${BUNDLE} creado -> ${slugs.length} historias (sin glosas: las escribe rebuildTapGlosses)`);
  }
})().catch((e) => { console.error("FALLO:", e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => p.$disconnect());
