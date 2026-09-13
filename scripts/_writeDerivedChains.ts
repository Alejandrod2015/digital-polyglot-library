// Escribe como puntero los puentes que hoy solo existen derivados, para journeys vivos
// cuyo siguiente tambien esta vivo. En seco por defecto; --apply escribe.
import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { resolveNextJourney } from "../src/lib/journeyChain";
const prisma = new PrismaClient();
async function main() {
  const js = await prisma.journey.findMany({ select: { id: true, name: true, typeSlug: true, language: true, variant: true, levels: true, status: true, nextJourneyId: true } });
  for (const j of js.filter((x) => x.status === "active" && !x.nextJourneyId)) {
    const r = resolveNextJourney(j, js);
    if (!r || r.source !== "derived" || r.journey.status !== "active") continue;
    console.log(`${j.name} ${j.language}/${j.variant} ${j.levels[0]} -> ${r.journey.name} ${r.journey.levels[0]} (${r.journey.id})`);
    if (process.argv.includes("--apply")) await prisma.journey.update({ where: { id: j.id }, data: { nextJourneyId: r.journey.id } });
  }
  await prisma.$disconnect();
}
main();
