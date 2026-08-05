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
import { getEmailPreference, createEmailToken } from "@/lib/emailPreferences";
import {
  inviteTesterToBetaGroup,
  removeTester,
  isAscConfigured,
  getTesterState,
  sendTesterInvitation,
} from "@/lib/appStoreConnect";
import {
  getPlayBetaState,
  playGroupJoinUrl,
  playOptInUrl,
  isPlayBetaConfigured,
} from "@/lib/googlePlayBeta";
import { evaluateApplication, type BetaVerdict } from "@/lib/betaRules";
import { getBetaRules } from "@/lib/betaRulesConfig";
import { BETA_EMAIL_BUILDERS, type BetaEmailKind, type BetaEmailData } from "@/lib/emails/beta";
import { buildPersonalEmail } from "@/lib/emails/personal";
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
  "accepted_android",
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
 * Stores the provider's message id on the ledger row we already claimed.
 *
 * Never throws: the email is already out of the door by the time this runs, so
 * a bookkeeping failure must not turn a successful send into a reported
 * failure and trigger a duplicate on retry.
 */
async function recordProviderId(
  signupId: string,
  kind: string,
  releaseId: string,
  providerId: string | undefined,
): Promise<void> {
  if (!providerId) return;
  await prisma.betaEmailLog
    .update({
      where: { signupId_kind_releaseId: { signupId, kind, releaseId } },
      data: { providerId },
    })
    .catch((err) => {
      console.error("Could not store provider id (email was still sent):", err);
    });
}

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
  signup: Pick<BetaSignup, "id" | "email" | "firstName" | "targetLanguage" | "platform">;
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

  // Bulk senders must offer a working one-click opt-out (RFC 8058; Gmail and
  // Yahoo enforce it). The transactional kinds are answers to something the
  // applicant did and carry no footer, but everything else is lifecycle mail
  // and needs both the header and a token the footer link can act on.
  const isLifecycle = !TRANSACTIONAL_KINDS.has(kind);
  const unsubscribeToken = isLifecycle ? createEmailToken(signup.email) : undefined;
  const unsubscribeUrl = unsubscribeToken
    ? `${betaBaseUrl()}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`
    : null;

  const { subject, html, text } = BETA_EMAIL_BUILDERS[kind]({
    baseUrl: betaBaseUrl(),
    firstName: signup.firstName,
    targetLanguage: signup.targetLanguage,
    // Derived here rather than passed by each caller. The lifecycle emails
    // name a store ("open TestFlight and tap Update"), and a caller that
    // forgets this argument does not fail loudly: it silently sends an Android
    // tester an instruction for an app they do not have. One place to get it
    // right beats five places to get it wrong.
    platform: invitePlatform(signup.platform),
    // Derived from env, not from Play, so this stays free to compute inside a
    // loop that sends to every tester. The live-state versions passed by
    // `inviteAndroidApplicant` override these, because `args.data` spreads last.
    playOptInUrl: playOptInUrl(),
    playGroupJoinUrl: playGroupJoinUrl(),
    unsubscribeToken,
    ...args.data,
  });

  try {
    const resend = new Resend(apiKey);
    const sent = await resend.emails.send({
      from,
      to: signup.email,
      subject,
      html,
      text,
      replyTo,
      ...(unsubscribeUrl
        ? {
            headers: {
              "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${replyTo}?subject=unsubscribe>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
      tags: [
        { name: "type", value: TRANSACTIONAL_KINDS.has(kind) ? "transactional" : "lifecycle" },
        { name: "category", value: `beta-${kind}` },
      ],
    });
    // Keep the provider's id. "Was it delivered?" is a question worth being
    // able to answer in one lookup; without this it means listing every email
    // the account ever sent and filtering by address.
    await recordProviderId(signup.id, kind, releaseId, sent.data?.id);
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
      googleEmail: signup.googleEmail,
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
/** ios | android | both, normalised. Anything unrecognised is iOS by history. */
export function invitePlatform(platform: string | null | undefined): "ios" | "android" {
  const p = (platform ?? "ios").toLowerCase();
  // `both` goes down the iOS path on purpose. Someone with two devices is
  // better tested on TestFlight: Apple delivers the invite itself, and the
  // Android flow costs the tester two manual steps for no extra signal.
  return p === "android" ? "android" : "ios";
}

/**
 * The Android half of `inviteApplicant`.
 *
 * There is no per-tester call to make. Google has no equivalent of Apple's
 * betaTesters resource: access comes from being in a Google Group that is
 * attached to the track, and our consumer group cannot be written to by any
 * API. So "inviting" is exactly one thing: sending the mail that carries the
 * join link and the opt-in link.
 *
 * Which is why this function refuses to send when the track is not ready. An
 * acceptance email whose links lead to an empty grey card is worse than no
 * email: the tester assumes the app is broken and does not come back. That is
 * not hypothetical, it is what happened to the first Android tester on
 * 2026-08-05, before any of this existed.
 */
async function inviteAndroidApplicant(signup: BetaSignup): Promise<InviteOutcome> {
  // Held rather than failed, and the applicant is told so. Nothing about them
  // is wrong; the track is not ready. Silence would be the wrong answer to a
  // form they just filled in, and until Android has a published build this is
  // the COMMON path, not the rare one. The Studio shows the real reason as one
  // banner over the whole Android cohort, so it is not stamped per row.
  async function hold(error: string): Promise<InviteOutcome> {
    console.warn(`⏸️ Android invite held for ${signup.email}: ${error}`);
    const emailed = await waitlistApplicant(signup.id);
    return { invited: false, status: "waitlist", error, emailed };
  }

  if (!isPlayBetaConfigured()) {
    return hold(
      "Google Play is not configured (GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL / GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY / GOOGLE_PLAY_PACKAGE_NAME)",
    );
  }

  const state = await getPlayBetaState();
  if (state.blockers.length > 0) {
    return hold(state.blockers.join(" "));
  }

  await prisma.betaSignup.update({
    where: { id: signup.id },
    data: { status: "invited", invitedAt: signup.invitedAt ?? new Date() },
  });

  const emailed = await sendBetaEmail({
    kind: "accepted_android",
    signup,
    data: {
      personalNote: signup.personalNote,
      playOptInUrl: state.optInUrl,
      playGroupJoinUrl: state.groupJoinUrl,
    },
  });
  return { invited: true, status: "invited", error: null, emailed };
}

export async function inviteApplicant(signupId: string): Promise<InviteOutcome> {
  const signup = await prisma.betaSignup.findUnique({ where: { id: signupId } });
  if (!signup) throw new Error(`BetaSignup ${signupId} not found`);

  if (invitePlatform(signup.platform) === "android") {
    // Re-sending is the whole retry story on Android: there is no group
    // membership to check and no invitation for Apple to have swallowed. The
    // ledger keeps the second call from mailing twice.
    if (signup.status === "invited" || signup.status === "accepted") {
      const state = await getPlayBetaState();
      const emailed = await sendBetaEmail({
        kind: "accepted_android",
        signup,
        data: {
          personalNote: signup.personalNote,
          playOptInUrl: state.optInUrl ?? playOptInUrl(),
          playGroupJoinUrl: state.groupJoinUrl ?? playGroupJoinUrl(),
        },
      });
      return { invited: true, status: signup.status, error: null, emailed };
    }
    return inviteAndroidApplicant(signup);
  }

  // Already invited by us. Do not add them to the group twice, but DO make
  // sure Apple actually invited them: being in the group is not the same as
  // having been sent the invitation, and this branch used to return success
  // without checking. On 2026-08-02 that left the first real applicant sitting
  // at NOT_INVITED while our own email told her to look for Apple's message.
  //
  // Re-firing the invitation is safe: Apple treats a second one as a resend,
  // and answers 409 for someone who is already testing.
  if (signup.status === "invited" || signup.status === "accepted") {
    let inviteError: string | null = null;
    if (signup.ascTesterId && isAscConfigured()) {
      const state = await getTesterState(signup.ascTesterId);
      if (state === "NOT_INVITED") {
        const inv = await sendTesterInvitation(signup.ascTesterId);
        inviteError = inv.ok ? null : (inv.error ?? "Apple did not send the invitation");
        console.log(`↻ Re-sent Apple invitation for ${signup.email}: ${inv.ok ? "ok" : inviteError}`);
      }
    }
    if (inviteError !== signup.ascError) {
      await prisma.betaSignup.update({ where: { id: signupId }, data: { ascError: inviteError } });
    }
    const emailed = await sendBetaEmail({
      kind: "accepted",
      signup,
      data: { personalNote: signup.personalNote },
    });
    return { invited: true, status: signup.status, error: inviteError, emailed };
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

  // A tester who was added but not invited is worse than a failed invite: our
  // acceptance email tells them to look for Apple's message. Record it so the
  // Studio surfaces it instead of showing a clean "invited".
  const inviteIssue = result.invitationSent ? null : (result.invitationError ?? "Apple did not send the invitation");

  await prisma.betaSignup.update({
    where: { id: signupId },
    data: {
      status: "invited",
      invitedAt: signup.invitedAt ?? new Date(),
      ascTesterId: result.testerId,
      ascInvitedAt: new Date(),
      ascError: inviteIssue,
    },
  });

  const emailed = await sendBetaEmail({
    kind: "accepted",
    signup,
    data: { personalNote: signup.personalNote },
  });
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
 *
 * On Android only the plan half runs. Access there is group membership in a
 * consumer Google Group that no API can write to, so revoking it means either
 * removing the member by hand in groups.google.com or unpublishing the track
 * for everyone. Taking the plan back is what actually ends the perk, and it is
 * the half that matters.
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
      // `googleEmail` belongs here for the same reason `appleIdEmail` does: an
      // Android tester signs in with the Google account they joined the group
      // with far more often than with the address they typed on the form.
      OR: [{ email }, { appleIdEmail: email }, { googleEmail: email }],
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
 * Sends a plain personal note to one applicant, outside the design system.
 *
 * Uses the same ledger as every other send, keyed by `slug`, so the same note
 * cannot go out twice and a retry after a failure is safe. `slug` is the
 * purpose of the note ("variant-question"), not its text, so rewording it and
 * resending is still blocked: the point is one message per topic per person.
 *
 * No unsubscribe footer: this is one-to-one correspondence answering something
 * they wrote to us, not bulk mail. Replies land in the same inbox as the rest.
 */
export async function sendPersonalNote(args: {
  signup: Pick<BetaSignup, "id" | "email" | "firstName">;
  slug: string;
  subject: string;
  paragraphs: string[];
}): Promise<BetaSendResult> {
  const { signup, slug, subject, paragraphs } = args;

  const apiKey = process.env.RESEND_API_KEY;
  const replyTo = "support@digitalpolyglot.com";
  // NOT the shared EMAIL_FROM, which is "Digital Polyglot <noreply@...>". A
  // note whose body asks the reader to reply, sent from an address that says
  // noreply, contradicts itself on screen: the reply-to header makes it work
  // technically, but almost nobody replies to a noreply sender. System mail
  // keeps using EMAIL_FROM; one-to-one correspondence comes from a mailbox
  // that a human actually reads.
  const from = process.env.PERSONAL_EMAIL_FROM || "Alejandro from Digital Polyglot <support@digitalpolyglot.com>";
  if (!apiKey) {
    console.warn("⚠️ RESEND_API_KEY not set, skipping personal note");
    return "skipped";
  }

  try {
    await prisma.betaEmailLog.create({
      data: { signupId: signup.id, kind: "personal", releaseId: slug },
    });
  } catch {
    return "duplicate";
  }

  const { html, text } = buildPersonalEmail({
    firstName: signup.firstName,
    subject,
    paragraphs,
  });

  try {
    const resend = new Resend(apiKey);
    const sent = await resend.emails.send({
      from,
      to: signup.email,
      subject,
      html,
      text,
      replyTo,
      tags: [
        { name: "type", value: "personal" },
        { name: "category", value: `beta-personal-${slug}` },
      ],
    });
    await recordProviderId(signup.id, "personal", slug, sent.data?.id);
    console.log(`📧 Personal note (${slug}) sent to ${signup.email}`);
    return "sent";
  } catch (err) {
    console.error(`❌ Personal note (${slug}) failed for ${signup.email}:`, err);
    await prisma.betaEmailLog
      .delete({ where: { signupId_kind_releaseId: { signupId: signup.id, kind: "personal", releaseId: slug } } })
      .catch(() => undefined);
    return "failed";
  }
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
