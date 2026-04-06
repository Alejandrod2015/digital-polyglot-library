import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

const UNIVERSAL_TOPICS = [
  "Food & Everyday Life",
  "Home & Family",
  "Travel & Discovery",
  "Work & Study",
  "Shopping & Money",
  "Health & Wellbeing",
  "Community & Celebrations",
  "Meeting New People",
  "City & Getting Around",
  "Sports & Entertainment",
  "Technology & Media",
  "Emotions & Relationships",
  "Nature & Adventure",
  "Arts & Creativity",
  "Traditions & Daily Culture",
  "Folklore & Legends",
];

const SPECIALIZED_TOPICS: Record<string, string[]> = {
  conversacional: [
    "Humor & Wordplay",
    "Current Events & Opinions",
    "Personal Stories & Memories",
    "Debates & Different Perspectives",
  ],
  viajero: [
    "Airport & Transit",
    "Accommodation & Stays",
    "Local Discoveries",
    "Slang & Misunderstandings",
  ],
  negocios: [
    "Meetings & Presentations",
    "Negotiations & Deals",
    "Networking & Corporate Culture",
    "Events & Hosting",
  ],
  expatriado: [
    "Bureaucracy & Paperwork",
    "Housing & Settling In",
    "Banking & Contracts",
    "Doctors & Diagnoses",
    "Social Norms & Taboos",
  ],
  academico: [
    "Campus & University Life",
    "Research & Debate",
    "Environment & Sustainability",
    "History & Society",
  ],
  cultural: [
    "History & Society",
    "Slang & Misunderstandings",
    "Social Norms & Taboos",
    "Local Discoveries",
  ],
  hospitalidad: [
    "Guest Services & Front Desk",
    "Restaurant & Kitchen Life",
    "Events & Hosting",
    "Slang & Misunderstandings",
  ],
  salud: [
    "Doctors & Diagnoses",
    "Pharmacy & Emergencies",
    "Caregiving & Support",
    "Social Norms & Taboos",
  ],
};

function toSlug(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  // 1. Rename Genérico → Conversacional
  const generico = await prisma.journeyType.findUnique({ where: { slug: "generico" } });
  if (generico) {
    await prisma.journeyType.update({
      where: { slug: "generico" },
      data: { slug: "conversacional", label: "Conversacional" },
    });
    console.log("Renamed Genérico → Conversacional");
  }

  // 2. Rename topic labels that changed
  const renames: Record<string, string> = {
    "travel-plans": "Travel & Discovery",
    "city-transportation": "City & Getting Around",
  };
  for (const [oldSlug, newLabel] of Object.entries(renames)) {
    const existing = await prisma.topic.findUnique({ where: { slug: oldSlug } });
    if (existing) {
      await prisma.topic.update({
        where: { slug: oldSlug },
        data: { slug: toSlug(newLabel), label: newLabel },
      });
      console.log(`Renamed: ${existing.label} → ${newLabel}`);
    }
  }

  // 3. Delete topics that are no longer universal (they'll be re-created as specialized)
  const toDelete = ["Environment & Sustainability", "History & Society"];
  for (const label of toDelete) {
    const slug = toSlug(label);
    const existing = await prisma.topic.findUnique({ where: { slug } });
    if (existing && existing.label === label) {
      // Don't delete, just mark as not universal - we'll handle below
    }
  }

  // 4. Upsert all universal topics
  let order = 1;
  for (const label of UNIVERSAL_TOPICS) {
    const slug = toSlug(label);
    await prisma.topic.upsert({
      where: { slug },
      update: { label, isUniversal: true, sortOrder: order },
      create: { slug, label, isUniversal: true, sortOrder: order },
    });
    order++;
  }
  console.log(`Upserted ${UNIVERSAL_TOPICS.length} universal topics`);

  // 5. Collect all unique specialized topic labels
  const allSpecialized = new Set<string>();
  for (const topics of Object.values(SPECIALIZED_TOPICS)) {
    for (const t of topics) allSpecialized.add(t);
  }

  // 6. Upsert specialized topics (isUniversal = false)
  for (const label of allSpecialized) {
    const slug = toSlug(label);
    await prisma.topic.upsert({
      where: { slug },
      update: { label, isUniversal: false, sortOrder: order },
      create: { slug, label, isUniversal: false, sortOrder: order },
    });
    order++;
  }
  console.log(`Upserted ${allSpecialized.size} specialized topics`);

  // 7. Ensure all journey types exist
  const journeyTypes = [
    { slug: "conversacional", label: "Conversacional", sortOrder: 1 },
    { slug: "viajero", label: "Viajero", sortOrder: 2 },
    { slug: "negocios", label: "Negocios", sortOrder: 3 },
    { slug: "expatriado", label: "Expatriado", sortOrder: 4 },
    { slug: "academico", label: "Académico", sortOrder: 5 },
    { slug: "cultural", label: "Cultural", sortOrder: 6 },
    { slug: "hospitalidad", label: "Hospitalidad", sortOrder: 7 },
    { slug: "salud", label: "Salud", sortOrder: 8 },
  ];
  for (const jt of journeyTypes) {
    await prisma.journeyType.upsert({
      where: { slug: jt.slug },
      update: { label: jt.label, sortOrder: jt.sortOrder },
      create: jt,
    });
  }
  console.log(`Upserted ${journeyTypes.length} journey types`);

  // 8. Clear existing associations and create new ones
  await prisma.topicJourneyType.deleteMany({});

  for (const [jtSlug, topicLabels] of Object.entries(SPECIALIZED_TOPICS)) {
    const jt = await prisma.journeyType.findUnique({ where: { slug: jtSlug } });
    if (!jt) continue;

    for (const label of topicLabels) {
      const topic = await prisma.topic.findUnique({ where: { slug: toSlug(label) } });
      if (!topic) {
        console.warn(`Topic not found: ${label}`);
        continue;
      }
      await prisma.topicJourneyType.create({
        data: { topicId: topic.id, journeyTypeId: jt.id },
      });
    }
  }
  console.log("Created topic-journey associations");

  // 9. Clean up old topics that no longer exist
  const allValidSlugs = new Set([
    ...UNIVERSAL_TOPICS.map(toSlug),
    ...[...allSpecialized].map(toSlug),
  ]);
  const allTopics = await prisma.topic.findMany();
  for (const t of allTopics) {
    if (!allValidSlugs.has(t.slug)) {
      await prisma.topic.delete({ where: { id: t.id } });
      console.log(`Deleted stale topic: ${t.label} (${t.slug})`);
    }
  }

  // Summary
  const finalTopics = await prisma.topic.findMany({ orderBy: { sortOrder: "asc" } });
  const universal = finalTopics.filter((t) => t.isUniversal);
  const specialized = finalTopics.filter((t) => !t.isUniversal);
  const associations = await prisma.topicJourneyType.count();

  console.log("\n=== SUMMARY ===");
  console.log(`Universal topics: ${universal.length}`);
  console.log(`Specialized topics: ${specialized.length}`);
  console.log(`Total topics: ${finalTopics.length}`);
  console.log(`Associations: ${associations}`);

  for (const jt of journeyTypes) {
    const assocs = await prisma.topicJourneyType.findMany({
      where: { journeyType: { slug: jt.slug } },
      include: { topic: true },
    });
    console.log(`${jt.label}: ${universal.length} universal + ${assocs.length} specialized = ${universal.length + assocs.length} total`);
  }

  await prisma.$disconnect();
}

main();
