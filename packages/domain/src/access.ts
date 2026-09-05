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

export function canAccessFeaturedStory(opts: {
  plan: Plan;
  kind: "week" | "day";
}): boolean {
  const { plan, kind } = opts;

  if (plan === "premium" || plan === "polyglot" || plan === "owner") return true;

  if (plan === "basic") {
    return kind === "week" || kind === "day";
  }

  if (plan === "free") {
    return kind === "week";
  }

  return false;
}

export function canAccessStoryContent(opts: {
  plan: Plan;
  isWeeklyStory: boolean;
  isDailyStory: boolean;
  ownsBook?: boolean;
  /**
   * Historia de un journey. La app movil las sirve enteras, texto y audio,
   * por `/api/standalone-stories`, que no pide sesion ni mira el plan. La web
   * las renderizaba con el candado del catalogo, asi que el mismo contenido
   * estaba abierto en el telefono y cerrado en el navegador, y el candado no
   * defendia ningun ingreso: nadie tiene entitlement. Con sesion, pasa.
   */
  isJourneyStory?: boolean;
  /** Hay sesion iniciada. El journey es contenido de cuenta, no publico. */
  isSignedIn?: boolean;
}): boolean {
  const {
    plan,
    isWeeklyStory,
    isDailyStory,
    ownsBook = false,
    isJourneyStory = false,
    isSignedIn = false,
  } = opts;

  if (plan === "premium" || plan === "polyglot" || plan === "owner") return true;
  if (ownsBook) return true;
  if (isJourneyStory && isSignedIn) return true;

  if (plan === "basic") {
    return isWeeklyStory || isDailyStory;
  }

  if (plan === "free") {
    return isWeeklyStory;
  }

  return false;
}

export function canUseOfflineAccess(plan: Plan): boolean {
  return (
    plan === "basic" ||
    plan === "premium" ||
    plan === "polyglot" ||
    plan === "owner"
  );
}
