// Pone la cadena de journeys en el estado que manda la regla: enlaza SIEMPRE
// dentro del mismo tipo, misma lengua y misma variante, y borra cualquier
// puntero que cruce tipos. En seco por defecto; escribe con --apply.
import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const journeys = await prisma.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { id: true, name: true, language: true, variant: true, levels: true, typeSlug: true, status: true, nextJourneyId: true },
  });
  const byId = new Map(journeys.map((j) => [j.id, j]));
  const label = (j: (typeof journeys)[number]) => `${j.name} ${j.levels.join("/")} ${j.language}/${j.variant} [${j.status}]`;

  const plan: Array<{ id: string; from: string; to: string | null; why: string }> = [];

  // 1. Fuera los punteros que cruzan tipos.
  for (const j of journeys) {
    if (!j.nextJourneyId) continue;
    const to = byId.get(j.nextJourneyId);
    if (to && j.typeSlug && to.typeSlug === j.typeSlug) continue;
    plan.push({ id: j.id, from: label(j), to: null, why: "cruza tipos" });
  }

  // 2. Cada journey enlaza con el siguiente nivel de SU tipo, lengua y
  //    variante. El destino puede estar en borrador: el cron ya lo descarta
  //    hasta que se publique, y asi la cadena queda escrita una sola vez.
  for (const a of journeys) {
    if (!a.typeSlug) continue;
    const siguientes = journeys
      .filter((b) => b.id !== a.id && b.typeSlug === a.typeSlug && b.language === a.language && b.variant === a.variant)
      .filter((b) => (b.levels[0] ?? "") > (a.levels[0] ?? ""))
      .sort((x, y) => (x.levels[0] ?? "").localeCompare(y.levels[0] ?? ""));
    const next = siguientes[0];
    if (!next) continue;
    if (a.nextJourneyId === next.id) continue;
    plan.push({ id: a.id, from: label(a), to: next.id, why: `siguiente nivel del mismo tipo: ${label(next)}` });
  }

  if (plan.length === 0) {
    console.log("nada que cambiar");
  }
  for (const p of plan) {
    console.log(`${p.to ? "ENLAZA" : "BORRA "}  ${p.from}\n         ${p.why}`);
  }

  if (!apply) {
    console.log(`\n(en seco; ${plan.length} cambios. Repite con --apply para escribir)`);
    await prisma.$disconnect();
    return;
  }

  for (const p of plan) {
    await prisma.journey.update({ where: { id: p.id }, data: { nextJourneyId: p.to } });
  }
  console.log(`\n${plan.length} punteros escritos`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
