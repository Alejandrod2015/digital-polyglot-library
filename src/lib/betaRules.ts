// Beta triage engine. Scores one application the moment it arrives and says
// what to do with it: invite now, park for review, or decline.
//
// The design intent is that you only ever look at the middle bucket. Anything
// clearly good goes straight to TestFlight; anything clearly not a fit gets a
// polite decline; the ambiguous ones queue up for a human. Every threshold
// lives in StudioConfig so tuning the funnel never needs a deploy.
//
// This module is PURE and imports nothing. Acting on a verdict (inviting,
// emailing, granting a plan) is betaProgram.ts's job, and loading the config
// is betaRulesConfig.ts's, so the scoring can be run from a script or a test
// without a database anywhere near it.

export type BetaRulesConfig = {
  /** Score at or above this is invited without a human ever seeing it. */
  autoAcceptAt: number;
  /** Score below this is declined without a human ever seeing it. */
  autoDeclineBelow: number;
  /**
   * Ceiling on testers holding a live invite. Reaching it does not decline
   * anyone; it parks good applicants on the waitlist so the program grows at
   * a pace you can actually read the feedback from.
   */
  maxActiveTesters: number;
  /** Target languages the beta is currently recruiting for. */
  acceptedTargetLanguages: string[];
  /** Master switch. Off = every application queues, nothing is auto-invited. */
  autoInviteEnabled: boolean;

  // ── Program calendar. These drive the lifecycle cron, and every one of them
  // is null until you deliberately set it, so no end-of-beta email can fire
  // because a default date drifted past. ──

  /** ISO date the beta closes. Set it and the final survey schedules itself. */
  betaEndsAt: string | null;
  /** ISO date the app went live. Gates the review ask; null means never send. */
  launchedAt: string | null;
  /** Deep link to the App Store review sheet, used by the review ask. */
  appStoreReviewUrl: string | null;
  /** Days after the invite with no sign-in before the install nudge goes out. */
  installNudgeAfterDays: number;
  /** Days after a tester starts before the single-question feedback ask. */
  feedbackAskAfterDays: number;
  /** Days after a tester starts before the halfway survey. */
  midSurveyAfterDays: number;
  /** Days before betaEndsAt that the final survey goes out. */
  finalSurveyBeforeEndDays: number;
  /**
   * Final-survey score at or above which a tester is asked for a review.
   * Below it they get the recovery email instead, which asks what was missing
   * and never mentions the App Store.
   */
  reviewAskMinRating: number;
};

export const DEFAULT_BETA_RULES: BetaRulesConfig = {
  autoAcceptAt: 60,
  autoDeclineBelow: 30,
  maxActiveTesters: 100,
  acceptedTargetLanguages: ["Spanish", "German", "Italian", "French", "Portuguese"],
  autoInviteEnabled: true,
  betaEndsAt: null,
  launchedAt: null,
  appStoreReviewUrl: null,
  installNudgeAfterDays: 3,
  feedbackAskAfterDays: 7,
  midSurveyAfterDays: 21,
  finalSurveyBeforeEndDays: 5,
  reviewAskMinRating: 8,
};

// Throwaway-inbox domains. Not exhaustive by design: this catches the lazy
// case, and a determined signup with a real-looking address is exactly the
// kind of ambiguity the review queue exists for.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "fakeinbox.com",
  "mailnesia.com",
  "spamgourmet.com",
]);

function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase().trim() ?? "";
}

// Phrases that show up verbatim in applications written to get past a form
// rather than to say something. Matched on the lowercased reason.
const LOW_EFFORT_MARKERS = [
  "i want to test",
  "i want to try",
  "sounds good",
  "sounds interesting",
  "looks cool",
  "looks interesting",
  "nice app",
  "good app",
  "let me in",
  "please accept",
  "i like languages",
  "i love languages",
  "test the app",
  "want to be a beta tester",
];

export type BetaApplication = {
  email: string;
  appleIdEmail?: string | null;
  /** Google account the Android tester joins the testers group with. */
  googleEmail?: string | null;
  platform?: string | null;
  hasIPhone: boolean;
  targetLanguage: string;
  nativeLanguage: string;
  currentLevel: string;
  weeklyHours?: string | null;
  motivation?: string | null;
  referralSource?: string | null;
  applicationReason?: string | null;
};

export type BetaDecision = "auto_accept" | "queue" | "auto_decline";

export type BetaVerdict = {
  decision: BetaDecision;
  score: number;
  /** One line you can read in the Studio without opening the application. */
  reason: string;
  /** Every signal that moved the score, for the "why did it decide that" panel. */
  signals: Array<{ label: string; points: number }>;
};

/**
 * Scores the free-text "why are you applying" answer, which is the single
 * most predictive field: someone who writes two specific sentences about
 * their own situation tests the app, and someone who writes "i want to test"
 * installs it once and never returns.
 *
 * Worth up to 30 of the 100 points.
 */
function scoreApplicationReason(reason: string | null | undefined): {
  points: number;
  note: string;
} {
  const text = (reason ?? "").trim();
  if (!text) return { points: 0, note: "no reason given" };

  const lower = text.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  let points = 0;

  // Length, capped so an essay does not outrank a good short answer.
  if (words.length >= 60) points += 14;
  else if (words.length >= 30) points += 12;
  else if (words.length >= 15) points += 8;
  else if (words.length >= 8) points += 4;

  // Specificity: first person plus a concrete noun beats a generic pitch.
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length >= 2) points += 5;
  if (/\b(i|my|me|we)\b/i.test(text)) points += 3;
  // A number, a place, or a date is a strong tell that they are describing
  // their own life rather than restating the question.
  if (/\d/.test(text) || /\b(month|year|week|trip|move|moving|job|family|wife|husband|partner)\b/i.test(lower)) {
    points += 5;
  }

  // Penalties for the tells of a throwaway answer.
  if (LOW_EFFORT_MARKERS.some((m) => lower.includes(m)) && words.length < 25) points -= 8;
  // No capital letter anywhere and no punctuation: typed to satisfy a
  // validator, not to communicate.
  if (text === lower && !/[.!?,]/.test(text)) points -= 4;
  // The same word over and over is filler padding to clear the minimum.
  const unique = new Set(words.map((w) => w.toLowerCase())).size;
  if (words.length >= 12 && unique / words.length < 0.5) points -= 6;

  const clamped = Math.max(0, Math.min(30, points));
  const note =
    clamped >= 22 ? "specific, personal answer"
    : clamped >= 12 ? "reasonable answer"
    : clamped >= 6 ? "thin answer"
    : "low-effort answer";
  return { points: clamped, note };
}

function scoreWeeklyHours(hours: string | null | undefined): number {
  // Values come from the form as "1-3" | "4-7" | "8+".
  const h = (hours ?? "").trim();
  if (h.startsWith("8")) return 20;
  if (h.startsWith("4")) return 15;
  if (h.startsWith("1")) return 7;
  return 0;
}

function scoreMotivation(motivation: string | null | undefined): number {
  // Stakes predict retention: someone moving abroad in October opens the app
  // on a Tuesday night, someone learning "just for fun" does not.
  switch ((motivation ?? "").trim().toLowerCase()) {
    case "move abroad":
      return 12;
    case "work":
      return 11;
    case "family connection":
      return 10;
    case "travel":
      return 8;
    case "just for fun":
      return 5;
    default:
      return 5;
  }
}

function scoreReferral(source: string | null | undefined): number {
  // A referral you can trace back to a person or a long-form piece converts
  // better than a cold tap on a video.
  switch ((source ?? "").trim().toLowerCase()) {
    case "friend":
      return 10;
    case "podcast":
    case "blog or article":
      return 8;
    case "google search":
      return 8;
    case "instagram":
    case "tiktok":
      return 6;
    default:
      return 4;
  }
}

/**
 * Decides what happens to one application.
 *
 * Hard gates run first and short-circuit the score: no amount of enthusiasm
 * makes an applicant without an iPhone testable on an iOS-only beta.
 */
export function evaluateApplication(
  app: BetaApplication,
  rules: BetaRulesConfig,
  context: { activeTesterCount: number },
): BetaVerdict {
  const signals: Array<{ label: string; points: number }> = [];

  // ── Hard gates ──
  const platform = (app.platform ?? "ios").toLowerCase();
  const wantsIos = platform === "ios" || platform === "both";
  const wantsAndroid = platform === "android" || platform === "both";

  if (DISPOSABLE_DOMAINS.has(emailDomain(app.email))) {
    return {
      decision: "auto_decline",
      score: 0,
      reason: "Disposable email domain",
      signals: [{ label: "Disposable email domain", points: 0 }],
    };
  }

  // Applied for iOS without an iPhone. Since Android joined the beta this is
  // no longer "the beta is iOS-only", it is a contradiction inside one
  // application, so it stays a decline: there is no device to test on.
  if (wantsIos && !wantsAndroid && !app.hasIPhone) {
    return {
      decision: "auto_decline",
      score: 0,
      reason: "Applied for the iOS beta without an iPhone",
      signals: [{ label: "No iPhone", points: 0 }],
    };
  }

  if (wantsIos && !app.appleIdEmail?.trim()) {
    // Without an Apple ID there is nothing to send the TestFlight invite to.
    // Queue rather than decline: it is a missing field, not a bad applicant.
    return {
      decision: "queue",
      score: 0,
      reason: "No Apple ID on file, so the invite has nowhere to go",
      signals: [{ label: "Missing Apple ID", points: 0 }],
    };
  }

  // The Android mirror of the Apple ID gate, and it bites harder. Play grants
  // access by Google Group membership, so the tester link is useless unless we
  // know which Google account is supposed to join. Queue, same as above: a
  // missing field is a question to ask, not a reason to turn someone away.
  if (wantsAndroid && !wantsIos && !app.googleEmail?.trim()) {
    return {
      decision: "queue",
      score: 0,
      reason: "No Google account on file, so there is nobody to let into the testers group",
      signals: [{ label: "Missing Google account", points: 0 }],
    };
  }

  // ── Score ──
  const reason = scoreApplicationReason(app.applicationReason);
  signals.push({ label: `Application text: ${reason.note}`, points: reason.points });

  const hours = scoreWeeklyHours(app.weeklyHours);
  signals.push({ label: `Weekly hours: ${app.weeklyHours ?? "unknown"}`, points: hours });

  const languageAccepted = rules.acceptedTargetLanguages.some(
    (l) => l.toLowerCase() === app.targetLanguage.trim().toLowerCase(),
  );
  const languagePoints = languageAccepted ? 20 : 0;
  signals.push({
    label: languageAccepted
      ? `Target language ${app.targetLanguage} is in the beta`
      : `Target language ${app.targetLanguage} is not being recruited for`,
    points: languagePoints,
  });

  const motivation = scoreMotivation(app.motivation);
  signals.push({ label: `Motivation: ${app.motivation ?? "unknown"}`, points: motivation });

  const referral = scoreReferral(app.referralSource);
  signals.push({ label: `Heard via: ${app.referralSource ?? "unknown"}`, points: referral });

  // Small trust signal: someone who took the trouble to give the right store
  // account is a person and not a form-filler.
  //
  // The social handle used to be worth 5 points here and the form asked for
  // it. Both are gone: an optional field whose own helper text had to promise
  // "we don't share or contact you there" is a field that is not earning its
  // place, and what actually shows a real applicant is the paragraph they
  // write about why they are applying. Old rows keep the column.
  let extras = 0;
  // Two different addresses mean they read the field instead of pasting the
  // same value twice. Asked of WHICHEVER store account they gave: when this
  // only looked at the Apple ID, an Android applicant could never earn the
  // three points, so identical answers scored three lower on Android and were
  // likelier to fall into the review band. A scoring bias nobody would have
  // chosen, arrived at by extending the form and forgetting the scorer.
  const contact = app.email.trim().toLowerCase();
  const storeAccounts = [app.appleIdEmail, app.googleEmail]
    .map((a) => a?.trim().toLowerCase())
    .filter((a): a is string => Boolean(a));
  if (storeAccounts.some((a) => a !== contact)) {
    extras += 3;
    signals.push({ label: "Store account differs from contact email", points: 3 });
  }

  const score = Math.max(
    0,
    Math.min(100, reason.points + hours + languagePoints + motivation + referral + extras),
  );

  // ── Verdict ──
  if (!languageAccepted) {
    return {
      decision: "queue",
      score,
      reason: `Not recruiting ${app.targetLanguage} right now`,
      signals,
    };
  }

  if (score < rules.autoDeclineBelow) {
    return { decision: "auto_decline", score, reason: `Score ${score} is below the decline floor`, signals };
  }

  if (!rules.autoInviteEnabled) {
    return { decision: "queue", score, reason: "Auto-invite is switched off", signals };
  }

  if (context.activeTesterCount >= rules.maxActiveTesters) {
    return {
      decision: "queue",
      score,
      reason: `Waitlisted: ${context.activeTesterCount}/${rules.maxActiveTesters} tester slots are full`,
      signals,
    };
  }

  if (score >= rules.autoAcceptAt) {
    return { decision: "auto_accept", score, reason: `Score ${score} clears the bar`, signals };
  }

  return { decision: "queue", score, reason: `Score ${score} is in the review band`, signals };
}
