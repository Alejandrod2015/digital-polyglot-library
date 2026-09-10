/**
 * SOLO LECTURA. Prueba de aceptacion del suelo de nivel B1.
 *
 *   1. Las 21 del Traveler PT-BR A1 publicado, declaradas b1, deben FALLAR
 *      `journey-vocab-level-floor`. Es el probe invertido: si un A1 pasa como
 *      B1, el gate no separa nada.
 *   2. Los dos B1 de espanol ya escritos deben SEGUIR pasandolo, porque el
 *      suelo se calibro por debajo de ellos y no sobre lo que tiene que
 *      aprobar.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { validateJourneyStories } from "../src/lib/validateJourneyStories";

const p = new PrismaClient();

async function mira(journeyId: string, etiqueta: string, nivelDeclarado: string) {
  const j = await p.journey.findUnique({ where: { id: journeyId }, select: { language: true, variant: true } });
  const st = await p.journeyStory.findMany({
    where: { journeyId, NOT: { text: null } },
    select: { slug: true, title: true, text: true, vocab: true, topic: true },
    orderBy: { slotIndex: "asc" },
  });
  const checks = validateJourneyStories(
    st.map((s) => ({
      slug: s.slug ?? "", title: s.title ?? "", text: String(s.text),
      language: j?.language ?? "", level: nivelDeclarado,
      vocab: (s.vocab ?? []) as Array<{ word: string; surface?: string | null }>,
      topic: s.topic,
    })),
    { language: j?.language ?? "", level: nivelDeclarado, variant: j?.variant ?? "" },
  );
  const c = checks.find((x) => x.id === "journey-vocab-level-floor");
  console.log(`\n${etiqueta} (${st.length} hist., declarado ${nivelDeclarado})`);
  console.log(`  journey-vocab-level-floor: ${c ? c.status.toUpperCase() : "NO SALE"}`);
  if (c?.detail) console.log(`  ${c.detail}`);
}

async function main() {
  await mira("cmsyrge55000732u9oiu8wue3", "PT-BR A1 publicado, declarado B1 (debe FALLAR)", "b1");
  await mira("cmsyrge55000732u9oiu8wue3", "PT-BR A1 publicado, declarado A1 (el suelo no aplica)", "a1");
  const esB1 = await p.journey.findMany({
    where: { language: "spanish", levels: { has: "b1" }, status: { not: "archived" } },
    select: { id: true, variant: true },
  });
  for (const j of esB1) await mira(j.id, `ES ${j.variant} B1 ya escrito (debe PASAR)`, "b1");
}
main().catch((e) => console.error(String(e).slice(0, 800))).finally(() => p.$disconnect());
