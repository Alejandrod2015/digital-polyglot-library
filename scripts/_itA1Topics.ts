/**
 * Siembra los temas del Traveler IT A1 pasando por el porton de evidencia.
 *
 * Los siete dominios se eligieron contra el HUECO LEXICO del A0 (506 palabras
 * ya ensenadas, tolerancia cero), no contra un molde de curso. La evidencia
 * escrita de italiano es de dos frases y ninguna nombra un dominio; eso se
 * reporta, no se maquilla.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { assertTopicsGrounded } from "../src/lib/topicEvidence";

const prisma = new PrismaClient();

const PROPUESTAS = [
  { label: "Roads & Driving",          slug: "roads-and-driving",             evidence: ["Testing a new environment with a lot of audio"] },
  { label: "Phones & Signal",          slug: "phones-and-signal",             evidence: ["Testing a new environment with a lot of audio"] },
  { label: "Rooms & Keys",             existing: "rooms-and-keys",        evidence: ["To try new ways to learn"] },
  { label: "Forest & Hiking",          existing: "forest-and-hiking",     evidence: ["To try new ways to learn"] },
  { label: "Village Festivals",        slug: "village-festivals",         evidence: ["Testing a new environment with a lot of audio"] },
  { label: "Pharmacy & Emergencies",   existing: "pharmacy-emergencies",  evidence: ["To try new ways to learn"] },
  { label: "Bureaucracy & Paperwork",  existing: "bureaucracy-and-paperwork", evidence: ["Testing a new environment with a lot of audio"] },
];

async function run() {
  const existentes = await prisma.topic.findMany({ select: { slug: true, label: true } });
  await assertTopicsGrounded({
    language: "Italian",
    proposals: PROPUESTAS as never,
    existingLabels: ["Trains & Tickets","Coffee & Bars","Eating Out","Markets & Money","Churches & Squares","Meeting People","Sea & Islands"],
    prisma,
  });

  const clave = (p: any) => p.slug ?? p.existing;
  const porSlug = new Map(existentes.map((t) => [t.slug, t.label]));
  for (const p of PROPUESTAS) {
    const ya = porSlug.get(clave(p));
    if (ya && ya !== p.label) throw new Error(`slug ${clave(p)} ya es "${ya}", no "${p.label}" (1 slug = 1 label global)`);
    if (ya) { console.log(`  = ${clave(p)} ya existe con el mismo label`); continue; }
    if (process.argv.includes("--apply")) {
      await prisma.topic.create({ data: { slug: clave(p), label: p.label, isUniversal: false, sortOrder: 0 } });
      console.log(`  + ${clave(p)} = ${p.label}`);
    } else {
      console.log(`  + ${clave(p)} = ${p.label}   (dry)`);
    }
  }
  await prisma.$disconnect();
}
run().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
