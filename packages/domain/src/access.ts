export type Plan = "free" | "basic" | "premium" | "polyglot" | "owner" | undefined;

export type EffectivePlan = Exclude<Plan, undefined>;

/**
 * Modelo de suscripcion 2026-09 (muro duro + trial de 7 dias):
 * - free (sin cuenta): solo la historia del dia + previews.
 * - basic (con cuenta): tema 1 de su journey + la historia del dia.
 * - premium/polyglot/owner: todo.
 *
 * Gracia beta: toda cuenta creada ANTES de WALL_CUTOFF navega como premium
 * hasta BETA_GRACE_END y despues cae sola a basic. Cero accion manual en el
 * launch: el muro solo muerde a cuentas nuevas, y a las beta desde esa fecha.
 */
export const WALL_CUTOFF_MS = Date.parse("2026-09-07T00:00:00Z");
export const BETA_GRACE_END_MS = Date.parse("2027-04-01T00:00:00Z");

export function resolveEffectivePlan(opts: {
  plan: Plan;
  isSignedIn: boolean;
  /** Clerk user.createdAt en ms. Sin el (cuenta nueva o lookup fallido) no hay gracia. */
  userCreatedAtMs?: number | null;
  nowMs?: number;
}): EffectivePlan {
  const { plan, isSignedIn, userCreatedAtMs = null, nowMs = Date.now() } = opts;

  if (plan === "premium" || plan === "polyglot" || plan === "owner") return plan;
  if (!isSignedIn) return "free";

  const inBetaGrace =
    typeof userCreatedAtMs === "number" &&
    userCreatedAtMs < WALL_CUTOFF_MS &&
    nowMs < BETA_GRACE_END_MS;
  if (inBetaGrace) return "premium";

  return "basic";
}

export function isEntitledPlan(plan: Plan): boolean {
  return plan === "premium" || plan === "polyglot" || plan === "owner";
}

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
  /** Plan EFECTIVO (pasar por resolveEffectivePlan antes; aplica la gracia beta). */
  plan: Plan;
  ownsBook?: boolean;
  /** La historia pertenece al PRIMER tema de su journey (el suelo de basic). */
  isFirstTopicStory?: boolean;
  /** Es la historia del dia de su idioma (abierta para todos, incluso sin cuenta). */
  isDailyStory?: boolean;
}): boolean {
  const { plan, ownsBook = false, isFirstTopicStory = false, isDailyStory = false } = opts;

  if (isEntitledPlan(plan)) return true;
  if (ownsBook) return true;
  if (isDailyStory) return true;

  if (plan === "basic") {
    return isFirstTopicStory;
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
