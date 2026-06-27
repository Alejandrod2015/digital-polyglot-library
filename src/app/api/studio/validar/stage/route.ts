import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import {
  validateGeneratedStory,
  parseStoryInput,
  extractStoryMotifs,
  type ExistingStorySummary,
  type StoryPayload,
} from "@/lib/validateGeneratedStory";
import { persistAgentRun } from "@/lib/agentPersistence";
import { getIsoLanguageTag } from "@/lib/languageFlags";

/**
 * POST /api/studio/validar/stage
 *
 * Safe entry point from the /studio/validar UI into the real journey
 * pipeline. The worker pastes a story JSON and validates it; if it
 * passes, she picks a journey + level + topic and clicks "Subir al
 * Studio". This endpoint:
 *
 *   1. Re-validates the payload server-side against the LIVE list of
 *      stories already in that journey + level + topic (cross-story
 *      checks the client couldn't do without a round-trip).
 *   2. If anything fails, returns the failed checks without writing
 *      to the DB.
 *   3. If clean, creates a JourneyStory row with status="qa_pass"
 *      (invisible to end users; cover / audio / publish are still
 *      manual downstream steps).
 *   4. Records an AgentRun so the action is auditable.
 *
 * Hard gates:
 *   - validator must produce ok=true on the live re-check
 *   - studio-member access required
 *   - slot index is computed server-side (next free index in the
 *     journey/level/topic), no chance of the client picking a wrong
 *     slot
 */

type StageBody = {
  raw?: string;
  payload?: unknown;
  journeyId?: string;
  level?: string;
  topic?: string;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extractSpeakerNames(text: string): string[] {
  const re = /^([\p{Lu}][\p{L}\p{M}.'\-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'\-]*){0,3}):\s+\S/gmu;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) set.add(m[1].trim());
  return [...set];
}

async function loadExisting(
  journeyId: string,
  level: string,
  topic: string
): Promise<ExistingStorySummary[]> {
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

    const openingFirstSentence = r.text
      ? (r.text.split(/\n\n+/)[0] || "").split(/(?<=[.!?])\s+/)[0] || ""
      : "";
    return {
      title: r.title ?? "",
      arcType: r.arcType,
      vocabLemmas,
      characterNames: r.text ? extractSpeakerNames(r.text) : [],
      openingFirstSentence,
      motifTags: r.text ? extractStoryMotifs(r.text) : [],
    };
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: StageBody = {};
  try {
    body = (await req.json()) as StageBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { journeyId, topic } = body;
  // Normalize level to lowercase at write time. The validator and the
  // Studio inventory both treat case-insensitively, but the unique
  // constraint (journeyId, level, topic, slotIndex) is case-sensitive,
  // which previously created parallel A1/a1 buckets in the topic grid.
  const level = typeof body.level === "string" ? body.level.toLowerCase() : body.level;
  if (!journeyId || !level || !topic) {
    return NextResponse.json(
      { error: "journeyId, level and topic are required" },
      { status: 400 }
    );
  }

  // Resolve the payload: accept raw string or already-parsed object.
  const input = body.raw ?? body.payload;
  if (input === undefined || input === null) {
    return NextResponse.json(
      { error: "Provide `raw` (string) or `payload` (object)." },
      { status: 400 }
    );
  }

  const parsed: StoryPayload | null =
    typeof input === "string"
      ? parseStoryInput(input)
      : (input as StoryPayload);
  if (!parsed) {
    return NextResponse.json(
      { error: "Could not parse story payload." },
      { status: 400 }
    );
  }

  // Look up the journey to derive the language for cross-story checks.
  const journey = await prisma.journey.findUnique({
    where: { id: journeyId },
    select: { language: true, variant: true },
  });
  if (!journey) {
    return NextResponse.json({ error: "Journey not found" }, { status: 404 });
  }
  // DB stores `language` as a slug ("spanish", "german"...). Slicing the
  // first two chars would silently produce "SP"/"GE"/"PO" instead of the
  // real ISO codes "ES"/"DE"/"PT"; use the canonical mapping helper.
  const languageIso = getIsoLanguageTag(journey.language ?? "");

  // Re-validate server-side against the live state of the journey.
  const startedAt = new Date().toISOString();
  const existing = await loadExisting(journeyId, level, topic);
  // Cross-journey titles for anchor-repetition and template-monotony.
  const journeyTitlesRows = await prisma.journeyStory.findMany({
    where: { journeyId, title: { not: null } },
    select: { title: true },
  });
  const journeyTitles = journeyTitlesRows
    .map((r) => r.title!)
    .filter(Boolean);
  const result = await validateGeneratedStory(parsed, {
    language: languageIso,
    level,
    topic,
    existing,
    journeyTitles,
    variant: journey.variant ?? undefined,
  });

  if (!result.ok) {
    // Persist a failed attempt so the worker can see WHY the staging
    // failed even when the original /studio/validar run looked clean
    // (cross-story validation can fail on the server even if it passed
    // on the client without journey context).
    void persistAgentRun({
      agentKind: "validar",
      status: "needs_review",
      input: {
        payload: parsed as unknown as Record<string, unknown>,
        journeyId,
        level,
        topic,
        existingCount: existing.length,
        stage: "stage_blocked",
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
    }).catch((err) =>
      console.error("[studio/validar/stage] persistAgentRun failed", err)
    );

    return NextResponse.json(
      {
        ok: false,
        reason: "Re-validation against existing stories failed.",
        checks: result.checks,
        summary: result.summary,
      },
      { status: 409 }
    );
  }

  // Compute next slot index = max(existing) + 1, default 1.
  const slotAgg = await prisma.journeyStory.aggregate({
    where: { journeyId, level, topic },
    _max: { slotIndex: true },
  });
  const nextSlot = (slotAgg._max.slotIndex ?? 0) + 1;

  // Build a unique-ish slug. If a collision happens we suffix -2, -3, …
  const baseSlug = slugify(parsed.title) || `story-${nextSlot}`;
  let slug = baseSlug;
  let suffix = 1;
  while (
    await prisma.journeyStory.findFirst({
      where: { journeyId, slug },
      select: { id: true },
    })
  ) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
    if (suffix > 50) break; // sanity
  }

  // Vocab + word/vocab counts derived from the payload.
  const wordCount = parsed.text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const vocabCount = Array.isArray(parsed.vocab) ? parsed.vocab.length : 0;

  const story = await prisma.journeyStory.create({
    data: {
      journeyId,
      level,
      topic,
      slotIndex: nextSlot,
      slug,
      title: parsed.title,
      synopsis: parsed.synopsis,
      text: parsed.text,
      arcType: parsed.arcType,
      vocab: parsed.vocab as unknown as Parameters<
        typeof prisma.journeyStory.create
      >[0]["data"]["vocab"],
      wordCount,
      vocabCount,
      status: "qa_pass", // structural QA passed (this very endpoint did it)
    },
    select: {
      id: true,
      slug: true,
      title: true,
      level: true,
      topic: true,
      slotIndex: true,
      status: true,
    },
  });

  // Audit trail: who staged what, when.
  void persistAgentRun({
    agentKind: "validar",
    status: "completed",
    input: {
      payload: parsed as unknown as Record<string, unknown>,
      journeyId,
      level,
      topic,
      existingCount: existing.length,
      stage: "staged",
      storyId: story.id,
      stagedBy: userId,
    },
    output: {
      ok: true,
      checks: result.checks,
      summary: result.summary,
      parsed: result.parsed,
      storyId: story.id,
      slug: story.slug,
    } as unknown as Record<string, unknown>,
    toolsUsed: [],
    startedAt,
    completedAt: new Date().toISOString(),
  }).catch((err) =>
    console.error("[studio/validar/stage] persistAgentRun (success) failed", err)
  );

  return NextResponse.json({
    ok: true,
    story,
    existingCount: existing.length,
  });
}
