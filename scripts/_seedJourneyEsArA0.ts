/**
 * Siembra el journey Friends (relationships) · spanish/argentina · A0 con sus
 * 7 temas y sus 21 slots vacios. No escribe `text` ni `vocab`: el contenido
 * entra solo por saveStory.ts.
 *
 * Los siete temas pasan por `assertTopicsGrounded` ANTES de tocar la tabla:
 * cada uno cita, literalmente, una frase que un solicitante de espanol escribio
 * en BetaSignup.
 *
 *   npx tsx scripts/_seedJourneyEsArA0.ts --dry
 *   npx tsx scripts/_seedJourneyEsArA0.ts --apply
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded, type TopicProposal } from "../src/lib/topicEvidence";

const p = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const TOPICS: Array<TopicProposal & { slug: string }> = [
  { label: "Understanding & Repeating", slug: "understanding-and-repeating",
    evidence: ["instantly check translations"] },
  { label: "Borrowing & Lending", slug: "borrowing-and-lending",
    evidence: ["every time she need something"] },
  { label: "Fixing & Repairs", slug: "fixing-and-repairs",
    evidence: ["reached for or fixed"] },
  { label: "Time & Waiting", slug: "time-and-waiting",
    evidence: ["a little bit of a time crunch"] },
  { label: "Secrets & Promises", slug: "secrets-and-promises",
    evidence: ["and know peoples secrets"] },
  { label: "Couples & Introductions", slug: "couples-and-introductions",
    evidence: ["I started to learn Spanish for my new girlfriend"] },
  { label: "Work & Tiredness", slug: "work-and-tiredness",
    evidence: ["for my job and friends"] },
];

const JOURNEY = {
  name: "Friends",
  language: "spanish",
  variant: "argentina",
  typeSlug: "relationships",
  levels: ["a0"],
  storiesPerTopic: 3,
  status: "draft" as const,
};

async function main() {
  const js = await p.journey.findMany({
    where: { language: "spanish", status: { in: ["active", "draft"] } },
    select: { topics: true },
  });
  const yaSlugs = [...new Set(js.flatMap((j) => j.topics))];
  const yaLabels = (await p.topic.findMany({ where: { slug: { in: yaSlugs } }, select: { label: true } }))
    .map((l) => l.label!).filter(Boolean).sort();
  await assertTopicsGrounded({ language: "spanish", proposals: TOPICS, existingLabels: yaLabels, prisma: p });

  // 1 slug = 1 label global: ninguna etiqueta nueva puede estar ya en otro slug.
  const clashes = await p.topic.findMany({
    where: { label: { in: TOPICS.map((t) => t.label) } },
    select: { slug: true, label: true },
  });
  const bad = clashes.filter((c) => c.slug !== TOPICS.find((t) => t.label === c.label)!.slug);
  if (bad.length) throw new Error(`etiquetas ya usadas por otro slug:\n` + bad.map((c) => `  "${c.label}" -> ${c.slug}`).join("\n"));

  const existing = await p.journey.findFirst({
    where: { name: JOURNEY.name, language: JOURNEY.language, variant: JOURNEY.variant, levels: { has: "a0" } },
  });
  if (existing) { console.log(`YA EXISTE (${existing.id}); nada que hacer`); return; }

  const maxOrder = (await p.topic.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
  console.log(`${APPLY ? "APLICANDO" : "DRY RUN"}\nJourney: ${JOURNEY.name} · spanish/argentina · a0 · draft · type=${JOURNEY.typeSlug}`);
  TOPICS.forEach((t, i) => console.log(`  ${i + 1}. ${t.slug.padEnd(30)} -> ${t.label}`));
  if (!APPLY) { console.log("\n(dry run; corre con --apply)"); return; }

  for (const [i, t] of TOPICS.entries()) {
    await p.topic.upsert({
      where: { slug: t.slug },
      update: { label: t.label },
      create: { slug: t.slug, label: t.label, isUniversal: false, sortOrder: maxOrder + 1 + i },
    });
  }
  const journey = await p.journey.create({ data: { ...JOURNEY, topics: TOPICS.map((t) => t.slug) } });
  await p.journeyStory.createMany({
    data: TOPICS.flatMap((t) => [1, 2, 3].map((slotIndex) => ({
      journeyId: journey.id, level: "a0", topic: t.slug, slotIndex, status: "draft" as const,
    }))),
  });
  const n = await p.journeyStory.count({ where: { journeyId: journey.id } });
  console.log(`\nListo. Journey ${journey.id} con ${n} slots.`);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); }).finally(() => p.$disconnect());
