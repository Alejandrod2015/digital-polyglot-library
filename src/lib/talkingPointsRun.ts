// /src/lib/talkingPointsRun.ts
//
// Read state, and nothing else.
//
// WHY it is only this now: earlier versions kept a "run" of 7 chosen topics,
// because a journey is closed (21 and you're done) and that closure powers
// progress, "next" and completion. Non-fiction has no sequence: no piece
// depends on another, so a path would be a lie about the content. With the
// path gone, there is no run to persist and no completion to track.
//
// What is left is a RECORD, not a ladder: you have read this, or you have not.

const READ_KEY = "dpl.talkingPoints.read";

function readJson(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    // Private mode / disabled storage / corrupt value: start clean.
    return [];
  }
}

export function loadRead(): string[] {
  return readJson(READ_KEY);
}

export function markRead(pieceSlug: string): void {
  const current = loadRead();
  if (current.includes(pieceSlug)) return;
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify([...current, pieceSlug]));
  } catch {
    // Non-fatal: the mark just won't survive a reload.
  }
}
