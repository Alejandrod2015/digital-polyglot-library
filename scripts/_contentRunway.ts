import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const userId = process.argv[2];

async function run() {
  // 1) Journey tocado por el usuario
  const j = await prisma.journey.findUnique({
    where: { id: "cmrr5hp4f000c32k15lrvs0e1" },
    include: { stories: { select: { id: true, slug: true, title: true, status: true, topicSlug: true } } },
  }).catch(() => null);
  console.log("=== JOURNEY cmrr5hp4f000c32k15lrvs0e1 ===");
  if (j) {
    const anyJ = j as unknown as Record<string, unknown>;
    console.log({
      title: anyJ.title, slug: anyJ.slug, status: anyJ.status,
      language: anyJ.languageId ?? anyJ.language, level: anyJ.levelId ?? anyJ.level,
      variant: anyJ.variant, stories: j.stories.length,
    });
    const pub = j.stories.filter((s) => (s as { status: string }).status === "published");
    console.log(`historias publicadas: ${pub.length} / ${j.stories.length}`);
  } else console.log("(no encontrado)");

  // 2) Standalone consumidas vs disponibles
  const evs = await prisma.userMetric.findMany({
    where: { userId, bookSlug: "standalone-stories" },
    select: { storySlug: true },
  });
  const consumed = new Set(evs.map((e) => e.storySlug));
  console.log(`\n=== STANDALONE consumidas: ${consumed.size} ===`);
  const consumedRows = await prisma.standaloneStory.findMany({
    where: { slug: { in: [...consumed] } },
    select: { slug: true, language: true, variant: true, cefrLevel: true, level: true, topic: true, published: true, journeyEligible: true },
  });
  for (const r of consumedRows) console.log(`  ${r.slug}  ${r.language}/${r.variant}  ${r.cefrLevel ?? r.level}  topic=${r.topic ?? "-"}  pub=${r.published}`);

  const inventory = await prisma.standaloneStory.groupBy({
    by: ["language", "variant", "cefrLevel", "published"],
    _count: { _all: true },
    where: { language: { contains: "es", mode: "insensitive" } },
  });
  console.log(`\n=== INVENTARIO STANDALONE (español) ===`);
  for (const g of inventory.sort((a, b) => String(a.cefrLevel).localeCompare(String(b.cefrLevel)))) {
    console.log(`  ${g.language}/${g.variant ?? "-"}  ${g.cefrLevel ?? "-"}  pub=${g.published}  → ${g._count._all}`);
  }

  // Cuántas publicadas del mismo perfil que las que consume le quedan
  const profile = consumedRows[0];
  if (profile) {
    const sameLevel = await prisma.standaloneStory.findMany({
      where: { language: profile.language, cefrLevel: profile.cefrLevel, published: true },
      select: { slug: true, variant: true },
    });
    const left = sameLevel.filter((s) => !consumed.has(s.slug));
    console.log(`\n=== RUNWAY (mismo idioma+nivel ${profile.language}/${profile.cefrLevel}, publicadas) ===`);
    console.log(`  total=${sameLevel.length}  consumidas=${sameLevel.length - left.length}  restantes=${left.length}`);
    const byVariant = new Map<string, number>();
    for (const s of left) byVariant.set(s.variant ?? "-", (byVariant.get(s.variant ?? "-") ?? 0) + 1);
    console.log(`  restantes por variante: ${[...byVariant].map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }

  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
