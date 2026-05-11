// Feature flags for the Sanity -> Studio catalog migration.
//
// READ_FROM_STUDIO_BOOKS is a comma-separated list of book slugs that should
// be read from the Studio catalog tables (CatalogBook / CatalogStory) instead
// of the legacy Sanity-backed sources. When a slug is not in the list, the
// caller MUST fall back to the existing behavior.
//
// Rollout is per-slug so we can validate one book in production before moving
// the rest. Empty/unset variable = nothing changes (zero-risk deploy).

const PARSED_STUDIO_BOOKS: ReadonlySet<string> = new Set(
  (process.env.READ_FROM_STUDIO_BOOKS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

export function shouldReadBookFromStudio(bookSlug: string): boolean {
  return PARSED_STUDIO_BOOKS.has(bookSlug);
}

export function studioBookSlugs(): string[] {
  return Array.from(PARSED_STUDIO_BOOKS);
}
