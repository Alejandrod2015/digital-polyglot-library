/**
 * SOLO LECTURA. Pasa los 7 temas candidatos del Traveler PT-BR B1 por el porton
 * de evidencia (`assertTopicsGrounded`) sin crear nada, y avisa de choques de
 * slug o de label globales.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";

const prisma = new PrismaClient();

const A = "dividing my year between Brazil and England";
const D = "dating a Brazilian";
const C = "Have day to day conversations";

const TEMAS = [
  { slug: "arrivals-and-goodbyes",      label: "Arrivals & Goodbyes",       evidence: [A] },
  { slug: "rented-rooms-and-neighbours", label: "Rented Rooms & Neighbours", evidence: [A, C] },
  { slug: "buses-and-long-roads",       label: "Buses & Long Roads",        evidence: [A] },
  { slug: "appointments-and-paperwork", label: "Appointments & Paperwork",  evidence: [A] },
  { slug: "invitations-and-family-lunch", label: "Invitations & Family Lunch", evidence: [D] },
  { slug: "trails-and-guides",          label: "Trails & Guides",           evidence: [C] },
  { slug: "favours-and-small-debts",    label: "Favours & Small Debts",     evidence: [C] },
];

async function main() {
  for (const t of TEMAS) {
    const porSlug = await prisma.topic.findFirst({ where: { slug: t.slug }, select: { label: true } });
    if (porSlug) console.log(`CHOQUE: slug ${t.slug} ya existe con label "${porSlug.label}"`);
    const porLabel = await prisma.topic.findFirst({ where: { label: t.label }, select: { slug: true } });
    if (porLabel) console.log(`CHOQUE: label "${t.label}" ya lo usa ${porLabel.slug}`);
  }
  const existentes = (await prisma.journey.findMany({
    where: { language: "portuguese", status: { not: "archived" } }, select: { topics: true },
  })).flatMap((j) => j.topics);
  const labelsPrevias = (await prisma.topic.findMany({
    where: { slug: { in: existentes } }, select: { label: true },
  })).map((t) => t.label);

  try {
    await assertTopicsGrounded({
      language: "Portuguese",
      proposals: TEMAS,
      existingLabels: labelsPrevias,
      prisma,
    });
    console.log("\nPORTON: los 7 pasan.");
  } catch (e) {
    console.log("\nPORTON RECHAZA:\n" + String((e as Error).message));
  }
}
main().catch((e) => console.error(String(e).slice(0, 900))).finally(() => prisma.$disconnect());
