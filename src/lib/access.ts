// /src/lib/access.ts

export type Plan = "free" | "basic" | "premium" | "polyglot" | "owner" | undefined;

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
  if (plan === "premium" || plan === "polyglot" || plan === "owner") return true;
  return ownedBooks.includes(bookSlug);
}

/**
 * Controla si el usuario puede acceder a historias destacadas
 */
export function canAccessFeaturedStory(opts: {
  plan: Plan;
  kind: "week" | "day";
}): boolean {
  const { plan, kind } = opts;

  if (plan === "premium" || plan === "polyglot" || plan === "owner") return true;

  if (plan === "basic") {
    return kind === "week" || kind === "day"; // basic: week + day
  }

  if (plan === "free") {
    return kind === "week"; // free: solo week
  }

  return false;
}
