/**
 * One-shot admin endpoint that scans every practice exercise sentence
 * and applies the shared sanitizer. Fixes the orphan trailing-quote
 * pattern (e.g. `Grazie per l'aiuto!'`) that breaks TTS regeneration
 * across all existing rows generated before the sanitizer was wired
 * into the write paths.
 *
 *   GET   → dry run, returns which rows would change.
 *   POST  → applies the fix, returns counts.
 *
 * Both methods are admin-only. Idempotent: re-running has no effect
 * on already-clean rows.
 */
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getStudioMember } from "@/lib/studio-access";
import {
  isDirtyPracticeSentence,
  sanitizePracticeSentence,
} from "@/lib/sanitizePracticeSentence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAdmin(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "No email on account" }, { status: 403 });
  }
  const member = await getStudioMember(email);
  if (!member || member.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return null;
}

type Plan = {
  totalScanned: number;
  dirty: number;
  preview: Array<{ id: string; before: string; after: string }>;
};

async function buildPlan(): Promise<Plan> {
  // Pull every exercise row in batches. Set is small (~hundreds), so
  // we don't paginate yet; if it grows past ~10k rows we'd switch to
  // a cursor scan.
  const rows = await prisma.storyPracticeExercise.findMany({
    select: { id: true, sentence: true },
  });
  const preview: Plan["preview"] = [];
  let dirty = 0;
  for (const r of rows) {
    if (!r.sentence) continue;
    if (isDirtyPracticeSentence(r.sentence)) {
      dirty += 1;
      if (preview.length < 25) {
        preview.push({ id: r.id, before: r.sentence, after: sanitizePracticeSentence(r.sentence) });
      }
    }
  }
  return { totalScanned: rows.length, dirty, preview };
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const plan = await buildPlan();
  return NextResponse.json({ mode: "dry-run", ...plan });
}

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  // Scan everything, keep just the rows that match the dirty pattern,
  // and update them inside one transaction so a mid-loop failure
  // doesn't leave the table half-cleaned.
  const rows = await prisma.storyPracticeExercise.findMany({
    select: { id: true, sentence: true },
  });
  const toUpdate = rows.filter(
    (r) => r.sentence && isDirtyPracticeSentence(r.sentence),
  );
  await prisma.$transaction(
    toUpdate.map((r) =>
      prisma.storyPracticeExercise.update({
        where: { id: r.id },
        data: { sentence: sanitizePracticeSentence(r.sentence!) },
      }),
    ),
  );
  // Re-run the plan post-update so the response shows the post-state
  // (which should be 0 dirty if the sanitizer is correct).
  const after = await buildPlan();
  return NextResponse.json({
    mode: "applied",
    totalScanned: rows.length,
    updated: toUpdate.length,
    remainingDirty: after.dirty,
    samples: toUpdate.slice(0, 10).map((r) => ({
      id: r.id,
      before: r.sentence,
      after: sanitizePracticeSentence(r.sentence!),
    })),
  });
}
