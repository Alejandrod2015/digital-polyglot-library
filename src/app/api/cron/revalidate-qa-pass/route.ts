// /api/cron/revalidate-qa-pass
//
// Daily re-validation of every JourneyStory currently in `qa_pass`
// against the live `validateGeneratedStory` rules. Stories that no
// longer pass are demoted to `needs_review` so the worker sees them
// as pending fixes.
//
// Why this exists:
//   `qa_pass` is set at staging time by /api/studio/validar/stage. If
//   we later tighten the validator (e.g. zero-tolerance vocab-level-
//   frequency, expanded curated lists, removed LLM fallback), stories
//   that passed under the older, looser rules silently keep their
//   `qa_pass` flag even though they no longer would pass today. Without
//   re-validation, `qa_pass` becomes a stale claim.
//
//   This cron closes that gap: it runs daily, replays the validator on
//   every qa_pass story, and demotes drift. After the run, the
//   invariant `status === "qa_pass" → passes validator now` is
//   guaranteed.
//
//   Manual invocation is supported for ad-hoc checks (e.g. after the
//   admin edits `spanishA1A2.ts`). If CRON_SECRET is set in env, the
//   caller must pass `Authorization: Bearer <CRON_SECRET>`.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateGeneratedStory } from "@/lib/validateGeneratedStory";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — validator is fast but list is unbounded.

const LANG_MAP: Record<string, string> = {
  spanish: "es",
  german: "de",
  italian: "it",
};

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / no-auth mode
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

type DemotedRow = {
  id: string;
  language: string;
  level: string;
  topic: string;
  slot: number;
  title: string;
  fails: string[];
};

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";

  const stories = await prisma.journeyStory.findMany({
    where: { status: "qa_pass" },
    include: { journey: { select: { name: true, language: true } } },
    orderBy: [{ journeyId: "asc" }, { level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
  });

  const demoted: DemotedRow[] = [];
  let stillPassing = 0;

  for (const s of stories) {
    const j: { name: string; language: string } = (
      s as unknown as { journey: { name: string; language: string } }
    ).journey;
    const langCode = LANG_MAP[j.language] ?? "";
    const result = await validateGeneratedStory(
      {
        title: s.title ?? "",
        synopsis: s.synopsis ?? "",
        arcType: s.arcType ?? "late-reveal",
        text: s.text ?? "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vocab: (s.vocab as any[]) ?? [],
      },
      { language: langCode, level: s.level, topic: s.topic }
    );
    const fails = result.checks.filter((c) => c.status === "fail");
    if (fails.length === 0) {
      stillPassing++;
      continue;
    }
    demoted.push({
      id: s.id,
      language: j.language,
      level: s.level,
      topic: s.topic,
      slot: s.slotIndex,
      title: s.title ?? "(no title)",
      fails: fails.map((f) => `${f.id}: ${f.detail ?? f.label}`),
    });
  }

  if (!dryRun && demoted.length > 0) {
    await prisma.journeyStory.updateMany({
      where: { id: { in: demoted.map((d) => d.id) } },
      data: { status: "needs_review" },
    });
  }

  return NextResponse.json({
    ok: true,
    checked: stories.length,
    stillPassing,
    demotedCount: demoted.length,
    demoted,
    dryRun,
  });
}
