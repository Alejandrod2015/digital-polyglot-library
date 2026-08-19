// Sonda de solo lectura para el puente entre journeys: qué punteros hay, qué
// pares sobrevivirían a la regla de mismo tipo, y cuánto lleva la gente en los
// journeys candidatos. No escribe nada.
import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const journeys = await prisma.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { id: true, name: true, language: true, variant: true, levels: true, typeSlug: true, status: true, nextJourneyId: true },
    orderBy: [{ language: "asc" }, { name: "asc" }],
  });
  const byId = new Map(journeys.map((j) => [j.id, j]));

  console.log("\nPUNTEROS EXISTENTES");
  const withPointer = journeys.filter((j) => j.nextJourneyId);
  if (!withPointer.length) console.log("  ninguno");
  for (const j of withPointer) {
    const to = byId.get(j.nextJourneyId!);
    const sameType = to && j.typeSlug && to.typeSlug === j.typeSlug;
    console.log(
      `  ${j.name} ${j.levels.join("/")} ${j.variant} [${j.typeSlug ?? "sin tipo"}, ${j.status}] -> ` +
        `${to ? `${to.name} ${to.levels.join("/")} ${to.variant} [${to.typeSlug ?? "sin tipo"}, ${to.status}]` : "id no encontrado"}` +
        `  ${sameType ? "MISMO TIPO" : "CRUZA TIPOS"}`,
    );
  }

  console.log("\nCADENAS POSIBLES POR TIPO (mismo tipo, mismo idioma, misma variante)");
  for (const a of journeys) {
    for (const b of journeys) {
      if (a.id === b.id || !a.typeSlug) continue;
      if (a.typeSlug !== b.typeSlug || a.language !== b.language || a.variant !== b.variant) continue;
      const la = a.levels[0] ?? "";
      const lb = b.levels[0] ?? "";
      if (!la || !lb || la >= lb) continue;
      console.log(`  ${a.name} ${la} -> ${b.name} ${lb}  (${a.language}/${a.variant}, destino ${b.status})${a.nextJourneyId === b.id ? "  YA APUNTADO" : ""}`);
    }
  }

  const slug = process.argv[2];
  if (!slug) {
    console.log("\n(pasa un journeyId como argumento para ver el progreso de sus historias)");
    await prisma.$disconnect();
    return;
  }

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: slug, status: "published", slug: { not: null } },
    select: { slug: true },
  });
  const slugs = stories.map((s) => s.slug!).filter(Boolean);
  const rows = await prisma.userMetric.findMany({
    where: { storySlug: { in: slugs }, eventType: { in: ["audio_complete", "continue_listening"] } },
    select: { userId: true, storySlug: true, eventType: true, metadata: true, createdAt: true },
  });
  const byUser = new Map<string, Map<string, Date>>();
  for (const r of rows) {
    const md = r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : null;
    const p = typeof md?.progressSec === "number" ? md.progressSec : undefined;
    const d = typeof md?.audioDurationSec === "number" ? md.audioDurationSec : undefined;
    const complete = r.eventType === "audio_complete" || (p !== undefined && d !== undefined && d > 0 && p >= d * 0.95);
    if (!complete) continue;
    const per = byUser.get(r.userId) ?? new Map<string, Date>();
    if (!per.has(r.storySlug)) per.set(r.storySlug, r.createdAt);
    byUser.set(r.userId, per);
  }
  const target = byId.get(slug);
  console.log(`\nPROGRESO EN ${target?.name ?? slug} ${target?.levels.join("/") ?? ""} (${slugs.length} historias publicadas)`);
  const ranked = [...byUser.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 10);
  if (!ranked.length) console.log("  nadie con progreso");
  for (const [userId, per] of ranked) {
    const last = [...per.values()].reduce((a, b) => (a > b ? a : b));
    console.log(`  ${userId}  ${per.size}/${slugs.length}  ultima ${last.toISOString()}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
