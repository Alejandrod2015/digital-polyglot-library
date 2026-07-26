// Unredeemed-claim reminder engine.
//
// A buyer purchases a Digital Edition -> the Shopify webhook creates a
// ClaimToken and emails the access link. If they never open it
// (redeemedAt/redeemedBy stay null) they get NOTHING else and are lost: they
// paid and never received the goods. This engine resends the link on a capped
// cadence so those buyers are recovered automatically.
//
// Cadence (recommended defaults): reminder #1 at 48h, reminder #2 at 7 days,
// then stop (max 2). After the 2nd unsuccessful reminder the token is left for
// manual review and a digest is emailed to support.
//
// Safe by construction:
//  - Only unredeemed tokens whose books ALL resolve in the reader catalog
//    (never resend a link to a ghost/non-digital SKU).
//  - Respects a hard opt-out (unsubscribedAll).
//  - Idempotent per step via remindersSent / lastReminderAt.
//  - Batch-limited per run.

import { prisma } from "@/lib/prisma";
import { getCatalogBookMeta } from "@/lib/catalog";
import { sendClaimEmail } from "@/lib/email";
import { getEmailPreference } from "@/lib/emailPreferences";
import { Resend } from "resend";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const REMINDER_1_AFTER = 48 * HOUR; // first reminder: 48h after purchase
const REMINDER_2_AFTER = 7 * DAY; // second reminder: 7 days after purchase
const MAX_REMINDERS = 2;
const BATCH_LIMIT = 200;

const SUPPORT_EMAIL = "support@digitalpolyglot.com";
const READER_BASE = "https://reader.digitalpolyglot.com";

export interface ClaimReminderResult {
  scanned: number;
  sent: number;
  skipped: {
    notDue: number;
    unresolvedBooks: number;
    optedOut: number;
    failed: number;
  };
  exhausted: number; // hit MAX this run -> flagged for manual review
  // Populated only in dryRun: who WOULD be reminded, nothing sent.
  preview?: Array<{ to: string; books: string[]; reminderNumber: number; tokenTail: string }>;
}

/** Is a reminder due now, given how many were already sent and the token age? */
function isDue(remindersSent: number, ageMs: number): boolean {
  if (remindersSent === 0) return ageMs >= REMINDER_1_AFTER;
  if (remindersSent === 1) return ageMs >= REMINDER_2_AFTER;
  return false;
}

async function allBooksResolve(books: string[]): Promise<boolean> {
  for (const slug of books) {
    const meta = await getCatalogBookMeta(slug);
    if (!meta) return false;
  }
  return books.length > 0;
}

async function notifySupport(
  exhausted: Array<{ email: string; books: string[]; token: string }>
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from || exhausted.length === 0) return;

  const lines = exhausted.map(
    (e) => `• ${e.email} — ${e.books.join(", ")} — ${READER_BASE}/claim/${e.token}`
  );
  const text = [
    `${exhausted.length} paid buyer(s) still haven't redeemed after 2 reminders.`,
    "They need a manual follow-up (different channel / support outreach):",
    "",
    ...lines,
  ].join("\n");

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: SUPPORT_EMAIL,
      subject: `⚠️ ${exhausted.length} unredeemed purchase(s) need manual follow-up`,
      text,
      tags: [{ name: "type", value: "ops" }],
    });
  } catch (err) {
    console.error("❌ claim-reminders: support digest failed:", err);
  }
}

export async function runClaimReminders(
  now: Date = new Date(),
  opts: { dryRun?: boolean } = {}
): Promise<ClaimReminderResult> {
  const dryRun = opts.dryRun ?? false;
  const result: ClaimReminderResult = {
    scanned: 0,
    sent: 0,
    skipped: { notDue: 0, unresolvedBooks: 0, optedOut: 0, failed: 0 },
    exhausted: 0,
    ...(dryRun ? { preview: [] as NonNullable<ClaimReminderResult["preview"]> } : {}),
  };

  // Candidates: NOT actually granted to anyone (redeemedBy null is the true
  // "never accessed" signal; redeemedAt can be set by an old logged-out hit
  // without granting), not exhausted, not expired, old enough for reminder #1.
  // Finer cadence (48h vs 7d) is decided per row below.
  const candidates = await prisma.claimToken.findMany({
    where: {
      redeemedBy: null,
      remindersSent: { lt: MAX_REMINDERS },
      createdAt: { lte: new Date(now.getTime() - REMINDER_1_AFTER) },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_LIMIT,
  });

  result.scanned = candidates.length;
  const exhausted: Array<{ email: string; books: string[]; token: string }> = [];

  for (const c of candidates) {
    const ageMs = now.getTime() - c.createdAt.getTime();
    if (!isDue(c.remindersSent, ageMs)) {
      result.skipped.notDue++;
      continue;
    }

    if (!(await allBooksResolve(c.books))) {
      // Ghost/non-digital SKU that never got mapped: don't resend a dead link.
      console.warn(
        `⏭️ claim-reminders: books sin catálogo, no reenvío. token=${c.token.slice(-6)} books=${JSON.stringify(c.books)}`
      );
      result.skipped.unresolvedBooks++;
      continue;
    }

    const to = c.recipientEmail ?? c.buyerEmail;

    // Hard opt-out only (paid-but-undelivered good is semi-transactional).
    const pref = await getEmailPreference(to);
    if (pref.unsubscribedAll) {
      result.skipped.optedOut++;
      continue;
    }

    const newCount = c.remindersSent + 1;

    if (dryRun) {
      result.preview!.push({
        to,
        books: c.books,
        reminderNumber: newCount,
        tokenTail: c.token.slice(-6),
      });
      result.sent++; // "would send"
      if (newCount >= MAX_REMINDERS) result.exhausted++;
      continue;
    }

    const res = await sendClaimEmail({ to, token: c.token, books: c.books, reminder: true });
    if (res !== "sent") {
      result.skipped.failed++;
      continue;
    }

    await prisma.claimToken.update({
      where: { token: c.token },
      data: { remindersSent: newCount, lastReminderAt: now },
    });
    result.sent++;

    if (newCount >= MAX_REMINDERS) {
      result.exhausted++;
      exhausted.push({ email: to, books: c.books, token: c.token });
    }
  }

  if (!dryRun) await notifySupport(exhausted);
  return result;
}
