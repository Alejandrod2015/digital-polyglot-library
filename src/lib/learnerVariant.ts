import { languageOfVariant, normalizeVariant } from "@/lib/languageVariant";
import { prisma } from "@/lib/prisma";

/**
 * The variant of a language a learner asked to be taught, resolved for one
 * language and ready to filter content with.
 *
 * Two sources, in order:
 *  1. `preferredVariant` in Clerk publicMetadata, set from onboarding and from
 *     Settings on the web. This is the standing preference and always wins.
 *  2. `BetaSignup.targetVariant`, typed by the tester on the beta form. Beta
 *     testers never went through the web onboarding, so for them (1) is empty
 *     and this is the only place the answer exists.
 *
 * Returns null when there is nothing to act on: no preference stored, an
 * unmodelled answer ("unsure", "other", a free-typed country), or a preference
 * that belongs to a different language than the one being browsed. A null
 * result means "do not filter", never "show nothing".
 */
export async function resolveLearnerVariant(args: {
  language: string;
  publicMetadata?: Record<string, unknown> | null;
  clerkUserId?: string | null;
  emails?: string[];
}): Promise<string | null> {
  const normalizedLanguage = args.language.trim().toLowerCase();
  if (!normalizedLanguage) return null;

  const fromClerk = normalizeVariant(
    typeof args.publicMetadata?.preferredVariant === "string"
      ? args.publicMetadata.preferredVariant
      : null
  );
  const candidate = fromClerk ?? (await readBetaTargetVariant(args.clerkUserId, args.emails));
  if (!candidate) return null;

  // A preference from another language must not filter this one: somebody
  // learning German with "spain" still stored would otherwise match no track
  // at all.
  return languageOfVariant(candidate) === normalizedLanguage ? candidate : null;
}

async function readBetaTargetVariant(
  clerkUserId?: string | null,
  emails?: string[]
): Promise<string | null> {
  const cleanEmails = (emails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!clerkUserId && cleanEmails.length === 0) return null;

  const or: Array<Record<string, unknown>> = [];
  if (clerkUserId) or.push({ clerkUserId });
  if (cleanEmails.length > 0) {
    or.push({ email: { in: cleanEmails } });
    or.push({ appleIdEmail: { in: cleanEmails } });
    or.push({ googleEmail: { in: cleanEmails } });
  }

  const signup = await prisma.betaSignup.findFirst({
    where: { OR: or },
    select: { targetVariant: true },
    // A tester can hold more than one row (a second application from another
    // address); the most recent answer is the one they meant.
    orderBy: { createdAt: "desc" },
  });
  return normalizeVariant(signup?.targetVariant ?? null);
}
