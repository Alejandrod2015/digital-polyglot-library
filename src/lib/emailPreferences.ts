import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import type { LifecycleKind } from "@/lib/emails/lifecycle";

/**
 * Granular email preferences + signed unsubscribe tokens.
 *
 * Lifecycle emails fall into opt-out-able categories. Transactional emails
 * (beta confirmation, claim links) never pass through here. Preferences are
 * keyed by email so unsubscribe links work without a logged-in session.
 *
 * The DB lookup is fail-open: if the table doesn't exist yet (migration not
 * applied) or the query errors, we default to "send". An opt-out should never
 * be the reason an email silently disappears due to infra, but a real opt-out
 * row is always respected.
 */

export type EmailCategory = "progress" | "reminders";

/** Which opt-out category each lifecycle email belongs to. `welcome` has no
 * category: it's the first post-signup touch and only the master switch
 * (unsubscribedAll) can suppress it. */
const KIND_CATEGORY: Record<LifecycleKind, EmailCategory | null> = {
  welcome: null,
  nudge: "reminders",
  celebration: "progress",
  recap: "progress",
  next: "progress",
  winReminder: "reminders",
  winValue: "reminders",
  winSunset: "reminders",
};

export const CATEGORY_LABELS: Record<EmailCategory, { title: string; description: string }> = {
  progress: {
    title: "Progress & milestones",
    description: "When you finish a story, your weekly recap, and reading milestones.",
  },
  reminders: {
    title: "Reminders",
    description: "Nudges to pick up a story you started, and check-ins if you've been away.",
  },
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/* ── signed token (no expiry: unsubscribe links must not rot) ──────────── */

function getSecret(): string {
  return (
    process.env.EMAIL_UNSUBSCRIBE_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "dpl-email-unsubscribe-secret"
  );
}

function sign(encoded: string): string {
  return createHmac("sha256", getSecret()).update(encoded).digest("base64url");
}

/** Token that identifies an email for unsubscribe / manage links. No expiry
 * by design (CAN-SPAM/GDPR unsubscribe links must keep working). */
export function createEmailToken(email: string): string {
  const encoded = Buffer.from(normalizeEmail(email), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readEmailToken(token: string): string | null {
  const [encoded, providedSig] = (token ?? "").split(".");
  if (!encoded || !providedSig) return null;
  const expectedSig = sign(encoded);
  const a = Buffer.from(providedSig, "utf8");
  const b = Buffer.from(expectedSig, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const email = Buffer.from(encoded, "base64url").toString("utf8");
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

/* ── preference read/write ─────────────────────────────────────────────── */

export type EmailPreferenceState = {
  email: string;
  progress: boolean;
  reminders: boolean;
  unsubscribedAll: boolean;
};

const DEFAULT_STATE = (email: string): EmailPreferenceState => ({
  email: normalizeEmail(email),
  progress: true,
  reminders: true,
  unsubscribedAll: false,
});

/** Current preferences for an email. Returns defaults (all-subscribed) when no
 * row exists or the lookup fails (fail-open). */
export async function getEmailPreference(email: string): Promise<EmailPreferenceState> {
  const normalized = normalizeEmail(email);
  try {
    const row = await prisma.emailPreference.findUnique({ where: { email: normalized } });
    if (!row) return DEFAULT_STATE(normalized);
    return {
      email: normalized,
      progress: row.progress,
      reminders: row.reminders,
      unsubscribedAll: row.unsubscribedAll,
    };
  } catch {
    return DEFAULT_STATE(normalized);
  }
}

export async function setEmailPreference(
  email: string,
  patch: Partial<Pick<EmailPreferenceState, "progress" | "reminders" | "unsubscribedAll">>,
  userId?: string | null
): Promise<EmailPreferenceState> {
  const normalized = normalizeEmail(email);
  const data = {
    progress: patch.progress,
    reminders: patch.reminders,
    unsubscribedAll: patch.unsubscribedAll,
    ...(userId ? { userId } : {}),
  };
  const row = await prisma.emailPreference.upsert({
    where: { email: normalized },
    create: { email: normalized, ...data },
    update: data,
  });
  return {
    email: normalized,
    progress: row.progress,
    reminders: row.reminders,
    unsubscribedAll: row.unsubscribedAll,
  };
}

/** One-click unsubscribe: master kill switch. */
export async function unsubscribeAll(email: string, userId?: string | null): Promise<void> {
  await setEmailPreference(email, { unsubscribedAll: true }, userId);
}

/** Should a given lifecycle email be sent to this address? Fail-open. */
export async function shouldSendLifecycle(kind: LifecycleKind, email: string): Promise<boolean> {
  const pref = await getEmailPreference(email);
  if (pref.unsubscribedAll) return false;
  const category = KIND_CATEGORY[kind];
  if (!category) return true; // welcome: only the master switch blocks it
  return pref[category];
}
