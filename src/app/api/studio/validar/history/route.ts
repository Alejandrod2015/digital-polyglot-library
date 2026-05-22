import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";

/**
 * GET /api/studio/validar/history
 *
 * Feed editorial "Mis validaciones" para /studio/validar. Lista los
 * AgentRun(validar) DEL USUARIO actual, dedupeados por título (el más
 * reciente por título gana, los attempts anteriores se cuentan pero no
 * se listan separadamente). Cruza con JourneyStory por storyId del
 * stage exitoso, así sabemos si la historia llegó al Studio o sigue
 * pendiente.
 *
 * Por qué este endpoint existe:
 *   El inventario inferior de /studio/validar muestra slots ya en el
 *   journey ("66/68 publicadas"), pero no muestra el trabajo de
 *   validación que aún no se subió al pipeline. La trabajadora podía
 *   validar 10 stories y sentir que su trabajo era invisible. Este
 *   feed le devuelve esa visibilidad.
 *
 * Output shape:
 *   [{
 *     title: string;
 *     latestRunAt: ISO;
 *     attemptCount: number;            // total de runs para ese título
 *     latestStatus: "completed" | "needs_review" | "running" | "failed" | "queued";
 *     stageOutcome:                    // qué pasó en la última corrida
 *       | "staged"                     //   ✓ subió al Studio
 *       | "stage_blocked"              //   ⚠ intentó pero re-validar falló
 *       | "validate_only";             //   sólo validó, nunca clickeó subir
 *     storyId?: string | null;         // si staged, JourneyStory.id
 *     storyExists?: boolean;           // si storyId, sigue en DB?
 *     journeyName?: string | null;
 *     level?: string | null;
 *     topic?: string | null;
 *   }]
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Pull all validar runs, newest first. We dedupe in-memory because
  // distinct-by-JSON-field on Prisma is awkward and the volume is small
  // (worker scale, dozens-hundreds per week max).
  const runs = await prisma.agentRun.findMany({
    where: { agentKind: "validar" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      input: true,
      output: true,
      createdAt: true,
    },
  });

  type ParsedStory = {
    title?: string;
    synopsis?: string;
    text?: string;
    arcType?: string | null;
    level?: string;
    topic?: string;
    vocab?: Array<{ word?: string; definition?: string; type?: string | null }>;
  } | null;
  type RunInput = {
    raw?: string;
    payload?: ParsedStory;
    journeyId?: string;
    level?: string;
    topic?: string;
    stage?: "staged" | "stage_blocked";
    storyId?: string;
    stagedBy?: string;
  };
  type RunOutput = {
    ok?: boolean;
    storyId?: string;
    slug?: string;
    parsed?: ParsedStory;
    checks?: Array<{ id: string; ok: boolean; label?: string; detail?: string }>;
    summary?: { passed?: number; failed?: number; total?: number };
  } | null;

  function extractTitle(input: RunInput, output: RunOutput): string | null {
    if (input.payload?.title?.trim()) return input.payload.title.trim();
    if (output?.parsed?.title?.trim()) return output.parsed.title.trim();
    if (typeof input.raw === "string") {
      const m = input.raw.match(/"title"\s*:\s*"([^"]+)"/);
      if (m) return m[1].trim();
    }
    return null;
  }

  type Bucket = {
    runId: string;
    title: string;
    latestRunAt: Date;
    attemptCount: number;
    latestStatus: string;
    stageOutcome: "staged" | "stage_blocked" | "validate_only";
    storyId: string | null;
    journeyId: string | null;
    level: string | null;
    topic: string | null;
    parsed: ParsedStory;
    raw: string | null;
    checks: NonNullable<RunOutput>["checks"] | null;
    summary: NonNullable<RunOutput>["summary"] | null;
  };

  const byTitle = new Map<string, Bucket>();
  for (const run of runs) {
    const input = (run.input ?? {}) as RunInput;
    const output = (run.output ?? null) as RunOutput;
    const title = extractTitle(input, output);
    if (!title) continue;
    const key = title.toLowerCase();
    const existing = byTitle.get(key);
    if (existing) {
      // We're walking newest→oldest, so the first time we see a title
      // is the latest run. Subsequent encounters just bump count.
      existing.attemptCount += 1;
      continue;
    }
    let stageOutcome: Bucket["stageOutcome"] = "validate_only";
    if (input.stage === "staged") stageOutcome = "staged";
    else if (input.stage === "stage_blocked") stageOutcome = "stage_blocked";
    byTitle.set(key, {
      runId: run.id,
      title,
      latestRunAt: run.createdAt,
      attemptCount: 1,
      latestStatus: run.status,
      stageOutcome,
      storyId: input.storyId ?? output?.storyId ?? null,
      journeyId: input.journeyId ?? null,
      level: input.level ?? null,
      topic: input.topic ?? null,
      // Payload + validation report come from the LATEST run for that
      // title (we walk newest→oldest, so this is the first hit).
      parsed: output?.parsed ?? input.payload ?? null,
      raw: typeof input.raw === "string" ? input.raw : null,
      checks: output?.checks ?? null,
      summary: output?.summary ?? null,
    });
  }

  // Cross-check storyId existence + pull journey name.
  const storyIds = [...byTitle.values()]
    .map((b) => b.storyId)
    .filter((s): s is string => !!s);
  const journeyIds = [...byTitle.values()]
    .map((b) => b.journeyId)
    .filter((s): s is string => !!s);

  const [storiesAlive, journeys] = await Promise.all([
    storyIds.length > 0
      ? prisma.journeyStory.findMany({
          where: { id: { in: storyIds } },
          select: { id: true, status: true, slug: true },
        })
      : Promise.resolve([]),
    journeyIds.length > 0
      ? prisma.journey.findMany({
          where: { id: { in: journeyIds } },
          select: { id: true, name: true, language: true },
        })
      : Promise.resolve([]),
  ]);
  const storyMap = new Map(storiesAlive.map((s) => [s.id, s]));
  const journeyMap = new Map(journeys.map((j) => [j.id, j]));

  const items = [...byTitle.values()]
    .sort((a, b) => b.latestRunAt.getTime() - a.latestRunAt.getTime())
    .map((b) => {
      const story = b.storyId ? storyMap.get(b.storyId) : null;
      const journey = b.journeyId ? journeyMap.get(b.journeyId) : null;
      return {
        runId: b.runId,
        title: b.title,
        latestRunAt: b.latestRunAt.toISOString(),
        attemptCount: b.attemptCount,
        latestStatus: b.latestStatus,
        stageOutcome: b.stageOutcome,
        storyId: b.storyId,
        storyStatus: story?.status ?? null,
        storyExists: story !== null && story !== undefined,
        journeyId: b.journeyId,
        journeyName: journey?.name ?? null,
        journeyLanguage: journey?.language ?? null,
        level: b.level,
        topic: b.topic,
        // Detalle expandible per-row (parsed payload + validation
        // report). El UI muestra esto al clickear la fila.
        parsed: b.parsed,
        raw: b.raw,
        checks: b.checks,
        summary: b.summary,
      };
    });

  return NextResponse.json({ items });
}
