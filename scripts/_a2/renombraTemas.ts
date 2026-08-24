/**
 * Rebautiza los 7 temas del Traveler ES/Spain A2 para que cada nombre diga el
 * DOMINIO LÉXICO que enseñan sus tres historias, no el ánimo que comparten.
 *
 * WHY (2026-08-25): los nombres originales ("Fetching & Handing Over",
 * "Nerves & Courage", "Company & Long Afternoons") nombraban un gesto o un
 * estado de ánimo. Un alumno que mira la lista no sabe qué palabras se lleva.
 * Salieron así porque los elegí DESPUÉS de medir el vocabulario libre: el A1 y
 * el B1 ya se habían llevado el bar, la compra, la casa y el transporte, y
 * bauticé lo que sobraba por lo que las historias tenían en común.
 *
 * Los nombres nuevos salen del vocabulario REAL de cada trío, leído de la base.
 * "Hands & Gestures" se queda: ese sí nombra su dominio (dedo, mano, brazo,
 * uña, hombro, seña).
 *
 *   npx tsx scripts/_a2/renombraTemas.ts [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { createRequire } from "module";
const req = createRequire(__filename);
try {
  const sp = req.resolve("server-only");
  (req as unknown as { cache: Record<string, unknown> }).cache[sp] = { id: sp, filename: sp, loaded: true, exports: {} };
} catch { /* noop */ }

import { PrismaClient } from "../../src/generated/prisma";
import { assertTopicsGrounded } from "../../src/lib/topicEvidence";

const J = "cmt70xfyt000l3283gxd70wck";
const prisma = new PrismaClient();

/** viejo slug -> { slug, label, evidence } */
const CAMBIOS: Record<string, { slug: string; label: string; evidence: string[] }> = {
  "baskets-and-errands": {
    slug: "errands-and-parcels", label: "Errands & Parcels",
    evidence: ["every time she need something, that I can’t seem to understand, reached for or fixed"],
  },
  "rest-and-siesta": {
    slug: "rest-and-free-time", label: "Rest & Free Time",
    evidence: ["He lives with his grandmother who only speaks Spanish"],
  },
  "vegetables-and-footpaths": {
    slug: "countryside-and-gardens", label: "Countryside & Gardens",
    evidence: ["To be able to speak  Spanish when travelling to Spain"],
  },
  "pots-and-pans": {
    slug: "cooking-and-kitchen", label: "Cooking & Kitchen",
    evidence: ["He lives with his grandmother who only speaks Spanish"],
  },
  "feelings-and-phone-calls": {
    slug: "feelings-and-confidence", label: "Feelings & Confidence",
    evidence: ["I don’t want to call my boyfriend over every time she need something"],
  },
  "papers-keys-and-money": {
    slug: "paperwork-and-keys", label: "Paperwork & Keys",
    evidence: ["Holiday home in Spain and I wish to talk to neighbours"],
  },
};

(async () => {
  const dry = process.argv.includes("--dry");

  await assertTopicsGrounded({
    language: "spanish",
    proposals: Object.values(CAMBIOS).map((c) => ({ label: c.label, slug: c.slug, evidence: c.evidence })),
    prisma,
  });
  console.log("evidencia: OK para los 6 nombres nuevos");

  const j = await prisma.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const orden = ((j?.topics as string[]) ?? []).map((s) => CAMBIOS[s]?.slug ?? s);

  for (const [viejo, nuevo] of Object.entries(CAMBIOS)) {
    const n = await prisma.journeyStory.count({ where: { journeyId: J, topic: viejo } });
    console.log(`  ${viejo} -> ${nuevo.slug}  "${nuevo.label}"  (${n} historias)`);
    if (dry) continue;
    await prisma.topic.upsert({
      where: { slug: nuevo.slug },
      create: { slug: nuevo.slug, label: nuevo.label, isUniversal: false },
      update: { label: nuevo.label },
    });
    await prisma.journeyStory.updateMany({ where: { journeyId: J, topic: viejo }, data: { topic: nuevo.slug } });
  }

  if (!dry) {
    await prisma.journey.update({ where: { id: J }, data: { topics: orden as never } });
    console.log("orden del journey:", orden.join(" · "));
  } else {
    console.log("--dry: nada escrito. Orden que quedaría:", orden.join(" · "));
  }
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
