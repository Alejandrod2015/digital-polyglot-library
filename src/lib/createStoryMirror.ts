// /src/lib/createStoryMirror.ts
//
// Deprecated. The Sanity `standaloneStory` mirror with sourceType="create"
// is gone after the Sanity -> Studio migration. The UserStory row in
// Prisma is now the single source of truth.
//
// The export is preserved as a no-op so existing callers compile without
// needing edits everywhere; new code should not call it.

export async function syncCreateStoryMirror(
  _story: Record<string, unknown>
): Promise<void> {
  // intentionally empty — UserStory is already written by the caller
}
