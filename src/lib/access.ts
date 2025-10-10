export type Plan = "basic" | "premium" | undefined;

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((i) => typeof i === "string");
}

export function getOwnedBooks(metadata: unknown): string[] {
  if (
    metadata &&
    typeof metadata === "object" &&
    "books" in (metadata as Record<string, unknown>)
  ) {
    const books = (metadata as Record<string, unknown>).books;
    return isStringArray(books) ? books : [];
  }
  return [];
}

export function canReadWholeBook(opts: {
  plan: Plan;
  ownedBooks: string[];
  bookSlug: string;
}): boolean {
  const { plan, ownedBooks, bookSlug } = opts;
  if (plan === "premium") return true;
  return ownedBooks.includes(bookSlug);
}
