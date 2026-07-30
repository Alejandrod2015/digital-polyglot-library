// Beta program orchestration: everything that ACTS on an application.
//
// betaRules.ts decides, this file does. Keeping the two apart means the
// scoring can be reasoned about (and changed) without touching anything that
// sends mail or talks to Apple.
//
// Every public function here is safe to call twice. The beta lifecycle cron,
// the Studio buttons and the public form all funnel through the same
// entry points, and none of them can assume they are the only caller.

import { Resend } from "resend";
import { createClerkClient } from "@clerk/backend";
import { prisma } from "@/lib/prisma";
import { getEmailPreference } from "@/lib/emailPreferences";
import { inviteTesterToBetaGroup, removeTester, isAscConfigured } from "@/lib/appStoreConnect";
import { evaluateApplication, type BetaVerdict } from "@/lib/betaRules";
import { getBetaRules } from "@/lib/betaRulesConfig";
import { BETA_EMAIL_BUILDERS, type BetaEmailKind, type BetaEmailData } from "@/lib/emails/beta";
import type { BetaSignup } from "@/generated/prisma";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

/** Plan a tester holds while the beta runs. Restored by the cron if clobbered. */
export const BETA_PLAN = "premium";

/**
 * Statuses that occupy a tester slot. `pending` is deliberately absent: an
 * application that has not been decided yet is not consuming capacity.
 */
const ACTIVE_STATUSES = ["invited", "accepted"];

/**
 * Kinds that must reach the applicant no matter what. These are answers to an
 * action they took, so an opt-out for marketing does not apply. Everything
 * else respects the master unsubscribe switch.
 */
const TRANSACTIONAL_KINDS = new Set<BetaEmailKind>([
  "accepted",
  "waitlist",
  "declined",
  "install_nudge",
]);

export function betaBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "https://digitalpolyglot.com";
}

export async function countActiveTesters(): Promise<number> {
  return prisma.betaSignup.count({ where: { status: { in: ACTIVE_STATUSES } } });
}

/* ────────────────────────────────────────────── email ledger */

export async function hasSentBetaEmail(
  signupId: string,
  kind: BetaEmailKind,
  releaseId = "",
): Promise<boolean> {
  const row = await prisma.betaEmailLog.findUnique({
    where: { signupId_kind_releaseId: { signupId, kind, releaseId } },
  });
  return row !== null;
}

export type BetaSendResult = "sent" | "skipped" | "failed" | "duplicate";

/**
 * Sends one beta email and writes the ledger row in the same breath.
 *
 * The ledger row is written BEFORE the send. If Resend then fails we delete
 * it again, so the failure is retryable. Writing it after the send would leave
 * a window where a crash between send and log produces a duplicate email,
 * which is the worse of the two failures: a tester who gets the same "you're
 * in" mail twice loses trust in the whole program.
 */
export async function sendBetaEmail(args: {
  kind: BetaEmailKind;
  signup: Pick<BetaSignup, "id" | "email" | "firstName" | "targetLanguage">;
  data?: BetaEmailData;
  releaseId?: string;
}): Promise<BetaSendResult> {
  const { kind, signup } = args;
  const releaseId = args.releaseId ?? "";

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const replyTo = "support@digitalpolyglot.com";
  if (!apiKey || !from) {
    console.warn(`⚠️ RESEND_API_KEY or EMAIL_FROM not set, skipping beta ${kind} email`);
    return "skipped";
  }

  if (!TRANSACTIONAL_KINDS.has(kind)) {
    const prefs = await getEmailPreference(signup.email);
    if (prefs.unsubscribedAll) {
      console.log(`🔕 Beta email (${kind}) skipped: ${signup.email} unsubscribed from everything`);
      return "skipped";
    }
  }

  // Claim the slot. A unique constraint violation means someone else already
  // sent this exact email, which is a success from the caller's point of view.
  try {
    await prisma.betaEmailLog.create({ data: { signupId: signup.id, kind, releaseId } });
  } catch {
    return "duplicate";
  }

  const { subject, html, text } = BETA_EMAIL_BUILDERS[kind]({
    baseUrl: betaBaseUrl(),
    firstName: signup.firstName,
    targetLanguage: signup.targetLanguage,
    ...args.data,
  });

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: signup.email,
      subject,
      html,
      text,
      replyTo,
      tags: [
        { name: "type", value: TRANSACTIONAL_KINDS.has(kind) ? "transactional" : "lifecycle" },
        { name: "category", value: `beta-${kind}` },
      ],
    });
    console.log(`📧 Beta email (${kind}) sent to ${signup.email}`);
    return "sent";
  } catch (err) {
    console.error(`❌ Beta email (${kind}) failed for ${signup.email}:`, err);
    // Release the slot so a retry can happen.
    await prisma.betaEmailLog
      .delete({ where: { signupId_kind_releaseId: { signupId: signup.id, kind, releaseId } } })
      .catch(() => undefined);
    return "failed";
  }
}

/* ────────────────────────────────────────────── decisions */

export type ApplicationOutcome = {
  decision: BetaVerdict["decision"];
  score: number;
  reason: string;
  status: string;
  invited: boolean;
  inviteError?: string | null;
  emailed: BetaSendResult | null;
};

/**
 * Runs the triage engine over one application and carries out the verdict.
 * Called by the public form right after the row is created, and by the Studio
 * "re-run rules" button.
 */
export async function processApplication(signupId: string): Promise<ApplicationOutcome> {
  const signup = await prisma.betaSignup.findUnique({ where: { id: signupId } });
  if (!signup) throw new Error(`BetaSignup ${signupId} not found`);

  const rules = await getBetaRules();
  const activeTesterCount = await countActiveTesters();

  const verdict = evaluateApplication(
    {
      email: signup.email,
      appleIdEmail: signup.appleIdEmail,
      platform: signup.platform,
      hasIPhone: signup.hasIPhone,
      targetLanguage: signup.targetLanguage,
      nativeLanguage: signup.nativeLanguage,
      currentLevel: signup.currentLevel,
      weeklyHours: signup.weeklyHours,
      motivation: signup.motivation,
      referralSource: signup.referralSource,
      applicationReason: signup.applicationReason,
      socialHandle: signup.socialHandle,
    },
    rules,
    { activeTesterCount },
  );

  await prisma.betaSignup.update({
    where: { id: signupId },
    data: {
      score: verdict.score,
      decision: verdict.decision,
      decisionReason: verdict.reason,
      decidedAt: new Date(),
    },
  });

  if (verdict.decision === "auto_accept") {
    const result = await inviteApplicant(signupId);
    return {
      decision: verdict.decision,
      score: verdict.score,
      reason: verdict.reason,
      status: result.status,
      invited: result.invited,
      inviteError: result.error,
      emailed: result.emailed,
    };
  }

  if (verdict.decision === "auto_decline") {
    const emailed = await declineApplicant(signupId, verdict.reason);
    return {
      decision: verdict.decision,
      score: verdict.score,
      reason: verdict.reason,
      status: "declined",
      invited: false,
      emailed,
    };
  }

  const emailed = await waitlistApplicant(signupId);
  return {
    decision: "queue",
    score: verdict.score,
    reason: verdict.reason,
    status: "waitlist",
    invited: false,
    emailed,
  };
}

export type InviteOutcome = {
  invited: boolean;
  status: string;
  error: string | null;
  emailed: BetaSendResult | null;
};

/**
 * Adds the applicant to the TestFlight beta group and sends the acceptance
 * email. Apple sends its own invite as a side effect of the group add; ours
 * explains what to do with it.
 *
 * A failed Apple call leaves the row in `waitlist` with the reason recorded,
 * so it shows up in the Studio as something to retry rather than vanishing.
 */
export async function inviteApplicant(signupId: string): Promise<InviteOutcome> {
  const signup = await prisma.betaSignup.findUnique({ where: { id: signupId } });
  if (!signup) throw new Error(`BetaSignup ${signupId} not found`);

  // Already invited: do not call Apple again, but do make sure the acceptance
  // email went out (the ledger makes the resend a no-op if it did).
  if (signup.status === "invited" || signup.status === "accepted") {
    const emailed = await sendBetaEmail({ kind: "accepted", signup });
    return { invited: true, status: signup.status, error: null, emailed };
  }

  if (!isAscConfigured()) {
    const error = "App Store Connect is not configured (ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY / ASC_APP_ID)";
    await prisma.betaSignup.update({
      where: { id: signupId },
      data: { status: "waitlist", ascError: error },
    });
    return { invited: false, status: "waitlist", error, emailed: null };
  }

  // TestFlight invites go to the Apple ID, which is frequently not the address
  // the applicant reads mail on. Contact email is only a fallback.
  const inviteEmail = signup.appleIdEmail?.trim() || signup.email;

  const result = await inviteTesterToBetaGroup({
    email: inviteEmail,
    firstName: signup.firstName,
  });

  if (!result.ok) {
    await prisma.betaSignup.update({
      where: { id: signupId },
      data: { status: "waitlist", ascError: result.error },
    });
    console.error(`❌ TestFlight invite failed for ${inviteEmail}: ${result.error}`);
    return { invited: false, status: "waitlist", error: result.error, emailed: null };
  }

  await prisma.betaSignup.update({
    where: { id: signupId },
    data: {
      status: "invited",
      invitedAt: signup.invitedAt ?? new Date(),
      ascTesterId: result.testerId,
      ascInvitedAt: new Date(),
      ascError: null,
    },
  });

  const emailed = await sendBetaEmail({ kind: "accepted", signup });
  return { invited: true, status: "invited", error: null, emailed };
}

export async function waitlistApplicant(signupId: string): Promise<BetaSendResult> {
  const signup = await prisma.betaSignup.update({
    where: { id: signupId },
    data: { status: "waitlist" },
  });
  return sendBetaEmail({ kind: "waitlist", signup });
}

export async function declineApplicant(
  signupId: string,
  reason?: string,
): Promise<BetaSendResult> {
  const signup = await prisma.betaSignup.update({
    where: { id: signupId },
    data: { status: "declined", ...(reason ? { decisionReason: reason } : {}) },
  });
  return sendBetaEmail({ kind: "declined", signup });
}

/**
 * Removes a tester from TestFlight and takes back the temporary plan. Used
 * when you kick someone, and by the close-the-beta script for everyone.
 */
export async function removeTesterAccess(
  signupId: string,
  opts: { revokePlan: boolean } = { revokePlan: true },
): Promise<{ ok: boolean; error?: string }> {
  const signup = await prisma.betaSignup.findUnique({ where: { id: signupId } });
  if (!signup) return { ok: false, error: "not found" };

  let error: string | undefined;
  if (signup.ascTesterId) {
    const res = await removeTester(signup.ascTesterId);
    if (!res.ok) error = res.error;
  }

  if (opts.revokePlan && signup.clerkUserId) {
    await revokeBetaPlan(signup.clerkUserId).catch((err) => {
      error = error ?? String(err);
    });
  }

  await prisma.betaSignup.update({
    where: { id: signupId },
    data: {
      ascTesterId: null,
      ...(opts.revokePlan ? { planRevokedAt: new Date() } : {}),
      ...(error ? { ascError: error } : {}),
    },
  });

  return error ? { ok: false, error } : { ok: true };
}

/* ────────────────────────────────────────────── plan grant */

/**
 * Links a fresh Clerk account to its beta application and hands over the
 * temporary plan. Called from the Clerk user.created webhook, so a tester who
 * signs up with the email they applied with is upgraded before they finish
 * looking at the first screen.
 *
 * Returns null when the email never applied to the beta, which is the common
 * case and not an error.
 */
export async function linkClerkUserToBetaSignup(args: {
  email: string;
  userId: string;
}): Promise<BetaSignup | null> {
  const email = args.email.trim().toLowerCase();
  const signup = await prisma.betaSignup.findFirst({
    where: {
      OR: [{ email }, { appleIdEmail: email }],
      status: { in: ACTIVE_STATUSES },
    },
  });
  if (!signup) return null;

  await grantBetaPlan(args.userId);

  return prisma.betaSignup.update({
    where: { id: signup.id },
    data: {
      clerkUserId: args.userId,
      // Signing in is the first hard evidence the invite was actually
      // redeemed, which is what separates "invited" from "accepted".
      status: "accepted",
      planGrantedAt: new Date(),
      planRevokedAt: null,
      lastActiveAt: new Date(),
    },
  });
}

export async function grantBetaPlan(userId: string): Promise<void> {
  const user = await clerkClient.users.getUser(userId);
  const current = user.publicMetadata ?? {};
  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...current,
      plan: BETA_PLAN,
      // Marked so the billing sync and the Studio can tell a beta grant from
      // a paid subscription. A tester who later buys a plan keeps the paid
      // one: the billing webhook overwrites `plan` and this flag goes stale
      // harmlessly, since revoking only ever downgrades to free.
      betaTester: true,
      betaGrantedAt: new Date().toISOString(),
    },
  });
}

export async function revokeBetaPlan(userId: string): Promise<void> {
  const user = await clerkClient.users.getUser(userId);
  const current = (user.publicMetadata ?? {}) as Record<string, unknown>;

  // Never downgrade someone who has paid. If a real entitlement exists, the
  // beta grant is irrelevant and the paid plan stands.
  const entitlement = await prisma.billingEntitlement.findUnique({ where: { userId } });
  const hasPaidPlan =
    entitlement !== null && ["active", "trialing", "in_grace_period"].includes(entitlement.status);

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...current,
      ...(hasPaidPlan ? {} : { plan: "free" }),
      betaTester: false,
      betaRevokedAt: new Date().toISOString(),
    },
  });
}

/**
 * Records that a tester used the app today. Called from the mobile session
 * endpoint, and it is the only engagement signal in the program that does not
 * depend on Apple telling us anything.
 */
export async function touchTesterActivity(userId: string): Promise<void> {
  await prisma.betaSignup
    .updateMany({ where: { clerkUserId: userId }, data: { lastActiveAt: new Date() } })
    .catch(() => undefined);
}
