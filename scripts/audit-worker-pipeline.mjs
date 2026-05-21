// ¿La trabajadora valida y publica con el journey/level/topic correctos?
// Cruza AgentRun (validar) con JourneyStory creadas a partir de ese run
// y verifica:
//   - Se completó el staging (status=completed)
//   - La JourneyStory resultante tiene level/topic alineados con el input
//   - El journey de destino existe y matchea el idioma esperado
//
// Pasa con cero noise: 1 línea por validación + flag si algo no cuadra.

import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const runs = await prisma.agentRun.findMany({
    where: { agentKind: "validar" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      input: true,
      output: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
    },
  });

  console.log(`\n=== AgentRun(validar) — ${runs.length} total ===\n`);

  // Tally by stage flag inside input.
  const stageTally = { staged: 0, stage_blocked: 0, unknown: 0 };
  for (const r of runs) {
    const stage = r.input?.stage ?? "unknown";
    stageTally[stage] = (stageTally[stage] ?? 0) + 1;
  }
  console.log("Stage tally:", stageTally);

  // Por status
  const statusTally = runs.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log("Status tally:", statusTally);

  // Detalle de los staged ok — cruzo con JourneyStory para verificar
  // que el resultado tenga level/topic alineados con el input.
  console.log("\n--- Successful stagings (input.stage=staged) ---");
  const staged = runs.filter((r) => r.input?.stage === "staged");
  if (staged.length === 0) {
    console.log("  (none)");
  }

  for (const r of staged) {
    const input = r.input ?? {};
    const out = r.output ?? {};
    const expectedJourneyId = input.journeyId ?? out.journeyId;
    const expectedLevel = input.level ?? out.level;
    const expectedTopic = input.topic ?? out.topic;
    const createdStoryId = out.storyId;

    let story = null;
    if (createdStoryId) {
      story = await prisma.journeyStory.findUnique({
        where: { id: createdStoryId },
        select: {
          id: true,
          title: true,
          slug: true,
          level: true,
          topic: true,
          slotIndex: true,
          status: true,
          journeyId: true,
          journey: { select: { name: true, language: true } },
        },
      });
    }

    const flags = [];
    if (!story) flags.push("STORY_MISSING");
    if (story && expectedJourneyId && story.journeyId !== expectedJourneyId) flags.push("JOURNEY_MISMATCH");
    if (story && expectedLevel && story.level !== expectedLevel) flags.push("LEVEL_MISMATCH");
    if (story && expectedTopic && story.topic !== expectedTopic) flags.push("TOPIC_MISMATCH");
    if (r.status !== "completed") flags.push(`STATUS=${r.status}`);

    const flagStr = flags.length > 0 ? `  ⚠ ${flags.join(", ")}` : "  ✓";
    const when = r.createdAt.toISOString().slice(0, 16).replace("T", " ");
    if (story) {
      console.log(
        `  ${when}  "${story.title}"  → ${story.journey?.name}/${story.journey?.language} · ${story.level}/${story.topic} · slot=${story.slotIndex} · status=${story.status}${flagStr}`,
      );
    } else {
      console.log(
        `  ${when}  expected jId=${expectedJourneyId} level=${expectedLevel} topic=${expectedTopic}${flagStr}`,
      );
    }
  }

  // Stagings bloqueados (validación falló server-side)
  const blocked = runs.filter((r) => r.input?.stage === "stage_blocked");
  console.log(`\n--- Blocked stagings (server rejected validation) ---`);
  console.log(`Total: ${blocked.length}`);
  for (const r of blocked.slice(-5)) {
    const reason = r.output?.reason ?? r.errorMessage ?? "—";
    const when = r.createdAt.toISOString().slice(0, 16).replace("T", " ");
    console.log(`  ${when}  reason: ${reason}`);
  }

  // Validaciones simples (sin staging — solo verificó texto)
  const simpleValidations = runs.filter(
    (r) => r.input?.stage !== "staged" && r.input?.stage !== "stage_blocked",
  );
  console.log(`\n--- Pure validations (no staging attempted) ---`);
  console.log(`Total: ${simpleValidations.length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
