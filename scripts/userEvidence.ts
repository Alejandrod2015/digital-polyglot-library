/**
 * Vuelca lo que los usuarios REALES dijeron que quieren, para que ninguna
 * decisión de contenido se tome desde la coherencia del catálogo.
 *
 *   npx tsx scripts/userEvidence.ts spanish
 *   npx tsx scripts/userEvidence.ts            (todos)
 *
 * Existe porque el 2026-08-16 diseñé un journey entero (temas, personajes,
 * tipo) sin mirar `BetaSignup.motivation`, que decía lo contrario de lo que
 * yo estaba proponiendo. Imprime SIEMPRE motivation y applicationReason: son
 * las dos frases donde la persona dice para qué quiere el idioma.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

const LANG = (process.argv[2] ?? "").toLowerCase();

async function run() {
  const rows = await prisma.betaSignup.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      email: true, firstName: true, status: true, targetLanguage: true,
      currentLevel: true, nativeLanguage: true, weeklyHours: true,
      motivation: true, learningGoal: true, applicationReason: true, referralSource: true,
      createdAt: true,
    },
  });
  const filtered = LANG ? rows.filter((r) => (r.targetLanguage ?? "").toLowerCase().includes(LANG)) : rows;

  const conMotivo = filtered.filter((r) => r.motivation?.trim() || r.learningGoal?.trim());
  const conGoal = filtered.filter((r) => r.learningGoal?.trim());
  console.log(`${filtered.length} solicitudes${LANG ? ` de ${LANG}` : ""} · ${conGoal.length} con learningGoal escrito\n`);

  for (const r of conMotivo) {
    console.log(`${(r.firstName ?? "?").padEnd(12)} ${r.targetLanguage} · ${r.currentLevel} · ${r.status} · ${r.weeklyHours ?? "?"} h/sem`);
    // El clic va primero porque segmenta; la frase escrita es la que sostiene
    // un tema, y por eso se imprime aunque el clic falte.
    if (r.motivation?.trim()) console.log(`  eligió:    ${r.motivation.trim()}`);
    if (r.learningGoal?.trim()) console.log(`  quiere decir: ${r.learningGoal.trim()}`);
    if (r.applicationReason?.trim()) console.log(`  por qué aquí: ${r.applicationReason.trim()}`);
    console.log();
  }

  // Lo que de verdad consumen, para contrastar lo dicho con lo hecho.
  const stories = await prisma.journeyStory.findMany({ select: { slug: true, journeyId: true } });
  const bySlug = new Map(stories.map((s) => [s.slug!, s.journeyId]));
  const done = await prisma.userMetric.findMany({
    where: { eventType: "audio_complete" },
    select: { userId: true, storySlug: true },
  });
  const perJourney = new Map<string, Set<string>>();
  for (const e of done) {
    const jid = bySlug.get(e.storySlug);
    if (!jid) continue;
    if (!perJourney.has(jid)) perJourney.set(jid, new Set());
    perJourney.get(jid)!.add(e.userId);
  }
  console.log("Historias terminadas por journey (lectores distintos):");
  for (const [jid, users] of [...perJourney].sort((a, b) => b[1].size - a[1].size)) {
    const j = await prisma.journey.findUnique({ where: { id: jid } });
    const a = j as unknown as Record<string, unknown> | null;
    if (!a) continue;
    console.log(`  ${String(a.name).padEnd(10)} ${a.language}/${a.variant} ${JSON.stringify(a.levels)}  ${users.size} lectores`);
  }
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
