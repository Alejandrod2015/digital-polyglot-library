import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  validateGeneratedStory,
  type ExistingStorySummary,
} from "@/lib/validateGeneratedStory";
import { persistAgentRun } from "@/lib/agentPersistence";

type ValidateBody = {
  raw?: string;
  payload?: unknown;
  journeyId?: string;
  level?: string;
  topic?: string;
  language?: string;
};

async function loadExistingStories(
  journeyId?: string,
  level?: string,
  topic?: string
): Promise<ExistingStorySummary[]> {
  if (!journeyId || !level || !topic) return [];

  const rows = await prisma.journeyStory.findMany({
    where: { journeyId, level, topic },
    select: { title: true, arcType: true, text: true, vocab: true },
  });

  type Row = {
    title: string | null;
    arcType: string | null;
    text: string | null;
    vocab: unknown;
  };

  return (rows as Row[]).map((r) => {
    const vocabArray = Array.isArray(r.vocab) ? (r.vocab as unknown[]) : [];
    const vocabLemmas = vocabArray
      .map((v) => {
        if (v && typeof v === "object" && "word" in v) {
          const w = (v as { word?: unknown }).word;
          return typeof w === "string" ? w : null;
        }
        return null;
      })
      .filter((w): w is string => !!w);

    const characterNames = r.text ? extractSpeakerNames(r.text) : [];

    return {
      title: r.title ?? "",
      arcType: r.arcType,
      vocabLemmas,
      characterNames,
    };
  });
}

function extractSpeakerNames(text: string): string[] {
  const re = /^([\p{Lu}][\p{L}\p{M}.'\-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'\-]*){0,3}):\s+\S/gmu;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) set.add(m[1].trim());
  return [...set];
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ValidateBody = {};
  try {
    body = (await req.json()) as ValidateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = body.raw ?? body.payload;
  if (input === undefined || input === null) {
    return NextResponse.json(
      { error: "Provide `raw` (string) or `payload` (object)." },
      { status: 400 }
    );
  }

  const startedAt = new Date().toISOString();

  try {
    const existing = await loadExistingStories(body.journeyId, body.level, body.topic);
    const result = await validateGeneratedStory(
      typeof input === "string" ? input : (input as Parameters<typeof validateGeneratedStory>[0]),
      {
        language: body.language,
        level: body.level,
        topic: body.topic,
        existing,
      }
    );

    // Persist the run so /studio/validar can render a collapsible
    // history pane the same way QA / Planner / Content do.
    // Best-effort: a DB failure must not break the validation
    // response, so we swallow errors and just log.
    void persistAgentRun({
      agentKind: "validar",
      status: result.ok ? "completed" : "needs_review",
      input: {
        raw: typeof input === "string" ? input : undefined,
        payload: typeof input === "string" ? undefined : (input as Record<string, unknown>),
        journeyId: body.journeyId ?? null,
        level: body.level ?? null,
        topic: body.topic ?? null,
        language: body.language ?? null,
        existingCount: existing.length,
      },
      output: {
        ok: result.ok,
        checks: result.checks,
        summary: result.summary,
        parsed: result.parsed,
      } as unknown as Record<string, unknown>,
      toolsUsed: [],
      startedAt,
      completedAt: new Date().toISOString(),
    }).catch((err) => {
      console.error("[studio/validar] persistAgentRun failed", err);
    });

    return NextResponse.json({
      ok: result.ok,
      checks: result.checks,
      summary: result.summary,
      parsed: result.parsed,
      existingCount: existing.length,
    });
  } catch (error) {
    console.error("[studio/validar] failed", error);
    void persistAgentRun({
      agentKind: "validar",
      status: "failed",
      input: {
        raw: typeof input === "string" ? input : undefined,
        payload: typeof input === "string" ? undefined : (input as Record<string, unknown>),
        journeyId: body.journeyId ?? null,
        level: body.level ?? null,
        topic: body.topic ?? null,
        language: body.language ?? null,
      },
      output: null,
      errorMessage: error instanceof Error ? error.message : "Validation failed",
      toolsUsed: [],
      startedAt,
      completedAt: new Date().toISOString(),
    }).catch((err) => {
      console.error("[studio/validar] persistAgentRun (failure) failed", err);
    });
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
