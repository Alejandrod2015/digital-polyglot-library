// Beta program email compositions. Same design system as the lifecycle sends
// (src/lib/emails/kit.ts) so a tester never sees two different products.
//
// The through-line across all of them: a beta tester is doing you a favour,
// and the only currency you can pay them in is evidence that their report
// changed the app. Every send either asks for something specific or shows
// them what their last answer produced. None of them say "we value your
// feedback" without naming the feedback.

import {
  DPE,
  EMAIL_ASSET_BASE,
  esc,
  shell,
  block,
  eyebrow,
  head,
  gold,
  lead,
  cta,
  ctaSecondary,
  hi,
  badge,
} from "./kit";
import type { BuiltEmail } from "./lifecycle";

export type BetaEmailKind =
  | "accepted"
  | "waitlist"
  | "declined"
  | "install_nudge"
  | "feedback_ask"
  | "mid_survey"
  | "release_note"
  | "final_survey"
  | "review_ask"
  | "review_recover";

export type BetaEmailData = {
  baseUrl?: string;
  assetBase?: string;
  firstName?: string | null;
  targetLanguage?: string | null;
  /** Public TestFlight redeem page. Apple sends its own invite too. */
  testflightUrl?: string | null;
  /** Where the in-app feedback / survey form lives for this tester. */
  feedbackUrl?: string | null;
  /** App Store review deep link, used only after a high final rating. */
  reviewUrl?: string | null;
  release?: {
    version: string;
    buildNumber: string;
    headline: string;
    whatsNew: string[];
    knownIssues?: string[];
    askThem?: string | null;
  };
  /**
   * This tester's own reports that shipped in this build. The single highest
   * leverage line in the whole program: name what they said, then show it
   * fixed.
   */
  fixedForThem?: string[];
  /** Days the beta still has to run, for the final-stretch sends. */
  daysLeft?: number;
  /**
   * Signed token for the footer's manage/unsubscribe links. Without it the
   * footer renders a link that cannot identify the recipient, which makes the
   * opt-out unusable for anyone not already logged in on the web.
   */
  unsubscribeToken?: string;
};

function base(data?: BetaEmailData): string {
  return data?.baseUrl ?? process.env.APP_BASE_URL ?? "https://digitalpolyglot.com";
}

function assetBase(data?: BetaEmailData): string {
  return data?.assetBase ?? EMAIL_ASSET_BASE;
}

function firstNameOr(data: BetaEmailData | undefined, fallback: string): string {
  const n = data?.firstName?.trim();
  return n && n.length > 0 ? n : fallback;
}

/** Bulleted list in the product's voice: no emoji, a gold rule per row. */
function bullets(items: string[], tone: "gold" | "sky" | "green" = "gold"): string {
  const color = tone === "gold" ? DPE.gold : tone === "sky" ? DPE.sky : DPE.green;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;">
    ${items
      .map(
        (t) => `<tr>
      <td width="10" valign="top" style="padding:0 10px 0 0;">
        <div style="width:6px;height:6px;border-radius:50%;background:${color};margin-top:9px;"></div>
      </td>
      <td style="padding:0 0 10px 0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.55;color:${DPE.fgSoft};">${esc(t)}</td>
    </tr>`,
      )
      .join("")}
  </table>`;
}

function card(inner: string, accent: string = DPE.cardLine): string {
  return `<div style="background:${DPE.screen};border:1px solid ${accent};border-radius:18px;padding:22px;text-align:left;box-shadow:0 20px 44px -22px rgba(0,0,0,0.7);">${inner}</div>`;
}

function cardTitle(text: string, color: string = DPE.faint): string {
  return `<div style="font-family:${DPE.font};font-weight:800;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${color};margin-bottom:10px;">${esc(text)}</div>`;
}

function note(text: string): string {
  return `<div style="margin-top:13px;font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};">${esc(text)}</div>`;
}

/* ══════════════════════════════════════════════ 1 · ACCEPTED */
// The one email that must not be vague. It has to answer, in order: am I in,
// what do I press, what do I get, and what do you want from me.
export function buildBetaAcceptedEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const lang = data?.targetLanguage?.trim() || "your language";
  const tfUrl = data?.testflightUrl ?? "https://apps.apple.com/app/testflight/id899247664";

  const steps = card(
    `${cardTitle("Getting in takes two minutes")}
    ${bullets([
      "Install TestFlight from the App Store if you do not have it yet. It is Apple's own app for testing.",
      "Open the invite email Apple just sent to your Apple ID and tap Accept.",
      "Install Digital Polyglot from inside TestFlight and sign in with this email address.",
    ])}`,
  );

  const perks = card(
    `${cardTitle("What you get", DPE.gold)}
    ${bullets(
      [
        "Full premium access for the whole beta. Every journey, every story, every voice.",
        "Your reports go straight to the person building the app, and you get told when they ship.",
      ],
      "gold",
    )}`,
    "rgba(252,211,77,0.3)",
  );

  const ask = card(
    `${cardTitle("What I need from you", DPE.sky)}
    <p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
      Use it the way you would actually use it. When something breaks, confuses you, or feels slow, tap ${hi("Send feedback")} in Settings. It takes one line. I read every single one.
    </p>`,
    "rgba(125,211,252,0.3)",
  );

  const blocks = [
    block(
      `${eyebrow("You're in")}${head(`Welcome to the<br/>${gold("beta")}, ${esc(name)}.`, 40)}${lead(
        `Your TestFlight invite is on its way to your Apple ID. You are testing ${esc(lang)}, with everything unlocked.`,
      )}`,
      "40px 44px 0",
    ),
    block(steps, "28px 44px 0", false),
    block(cta("Open TestFlight", tfUrl), "24px 44px 0"),
    block(perks, "24px 44px 0", false),
    block(ask, "16px 44px 0", false),
    block(
      note("If Apple's invite has not landed in 15 minutes, check the spam folder of your Apple ID address, then reply to this email and I will resend it."),
      "8px 44px 0",
    ),
  ];

  return {
    subject: "You're in: your TestFlight invite is on the way",
    html: shell({
      preheader: "Two minutes to install, then everything is unlocked.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `Welcome to the beta, ${name}.`,
      "",
      `Your TestFlight invite is on its way to your Apple ID. You are testing ${lang}, with everything unlocked.`,
      "",
      "Getting in takes two minutes:",
      "  1. Install TestFlight from the App Store if you do not have it yet.",
      "  2. Open Apple's invite email and tap Accept.",
      "  3. Install Digital Polyglot from TestFlight and sign in with this email address.",
      "",
      `TestFlight: ${tfUrl}`,
      "",
      "What you get: full premium access for the whole beta, and a direct line to the person building it.",
      "",
      "What I need: use it the way you actually would. When something breaks or confuses you, tap Send feedback in Settings. One line is enough. I read every one.",
      "",
      "If Apple's invite has not landed in 15 minutes, check the spam folder of your Apple ID address and reply here.",
      "",
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════════ 2 · WAITLIST */
// Honest about the reason. A waitlist email that pretends to be an acceptance
// burns the applicant twice.
export function buildBetaWaitlistEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const lang = data?.targetLanguage?.trim() || "your language";

  const blocks = [
    block(
      `${eyebrow("Application received")}${head(`You're on the<br/>${gold("shortlist")}.`, 40)}${lead(
        `Thanks for applying, ${esc(name)}. I run the beta in small groups so I can actually read every report, which means ${esc(lang)} testers go out in waves.`,
      )}`,
      "40px 44px 0",
    ),
    block(
      card(
        `${cardTitle("What happens next")}
        ${bullets([
          "You keep your place. There is nothing to reapply for.",
          "When the next wave opens, invites go out oldest first.",
          "You will hear from me either way. No silent rejections.",
        ])}`,
      ),
      "28px 44px 0",
      false,
    ),
    block(
      note("Nothing to do in the meantime. If your situation changes, or you have a question, just reply to this email."),
      "20px 44px 0",
    ),
  ];

  return {
    subject: "You're on the shortlist for the beta",
    html: shell({
      preheader: "Invites go out in waves. You keep your place.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `Thanks for applying, ${name}.`,
      "",
      `I run the beta in small groups so I can actually read every report, which means ${lang} testers go out in waves.`,
      "",
      "You keep your place, there is nothing to reapply for, and invites go out oldest first when the next wave opens. You will hear from me either way.",
      "",
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════════ 3 · DECLINED */
// Short, kind, and it does not pretend a door is open that is not.
export function buildBetaDeclinedEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");

  const blocks = [
    block(
      `${eyebrow("About your application")}${head(`Not this ${gold("round")}.`, 40)}${lead(
        `Thanks for applying, ${esc(name)}. The current beta is a small iPhone-only group aimed at a narrow set of languages, and your application is not a fit for it.`,
      )}`,
      "40px 44px 0",
    ),
    block(
      card(
        `<p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
          That is about the shape of this round, not about you. You can read on the web today at no cost, and I will write when the app opens up properly.
        </p>`,
      ),
      "28px 44px 0",
      false,
    ),
    block(ctaSecondary("Read on the web", `${b}/stories`), "24px 44px 0"),
  ];

  return {
    subject: "About your beta application",
    html: shell({
      preheader: "Not a fit for this round. Here is what you can do today.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `Thanks for applying, ${name}.`,
      "",
      "The current beta is a small iPhone-only group aimed at a narrow set of languages, and your application is not a fit for this round.",
      "",
      `You can read on the web today at no cost: ${b}/stories`,
      "",
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════════ 4 · INSTALL NUDGE */
// Sent when the invite went out and nothing happened. Assumes friction, not
// disinterest, because that is what it usually is.
export function buildBetaInstallNudgeEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const tfUrl = data?.testflightUrl ?? "https://apps.apple.com/app/testflight/id899247664";

  const blocks = [
    block(
      `${eyebrow("Your spot is still open")}${head(`Stuck on the<br/>${gold("install")}?`, 40)}${lead(
        `Hi ${esc(name)}. Your TestFlight invite went out a few days ago and it looks like the app never opened. That is usually Apple's email, not you.`,
      )}`,
      "40px 44px 0",
    ),
    block(
      card(
        `${cardTitle("The two things that go wrong")}
        ${bullets([
          "The invite went to your Apple ID address, which is often not the address you are reading this on. Check that inbox and its spam folder.",
          "TestFlight itself was never installed. It is a free Apple app, and the invite link does nothing without it.",
        ])}`,
      ),
      "28px 44px 0",
      false,
    ),
    block(cta("Install TestFlight", tfUrl), "24px 44px 0"),
    block(note("Still stuck? Reply with the Apple ID address you want it sent to and I will fire a fresh invite."), "16px 44px 0"),
  ];

  return {
    subject: "Your beta spot is still open",
    html: shell({
      preheader: "The invite is usually sitting in your Apple ID inbox.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `Hi ${name}.`,
      "",
      "Your TestFlight invite went out a few days ago and it looks like the app never opened. Two things usually explain it:",
      "",
      "  1. The invite went to your Apple ID address, which is often not the one you read email on. Check that inbox and its spam folder.",
      "  2. TestFlight was never installed. The invite link does nothing without it.",
      "",
      `Install TestFlight: ${tfUrl}`,
      "",
      "Still stuck? Reply with the Apple ID address you want it sent to and I will fire a fresh invite.",
      "",
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════════ 5 · FEEDBACK ASK */
// One question, not a survey. The ask is deliberately tiny because the reply
// rate on "tell us your thoughts" is close to zero.
export function buildBetaFeedbackAskEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const url = data?.feedbackUrl ?? `${b}/beta/feedback`;

  const blocks = [
    block(
      `${eyebrow("One question")}${head(`What ${gold("annoyed")} you<br/>the most?`, 40)}${lead(
        `A week in, ${esc(name)}. I do not want a review. I want the one thing that made you frown.`,
      )}`,
      "40px 44px 0",
    ),
    block(
      card(
        `<p style="margin:0 0 12px;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
          A slow screen. A word that would not tap. Audio that started late. A button you could not find. Whatever came to mind just now while reading this: that is the one.
        </p>
        <p style="margin:0;font-family:${DPE.font};font-weight:700;font-size:15.5px;line-height:1.6;color:${DPE.fg};">
          One sentence is a complete answer.
        </p>`,
      ),
      "28px 44px 0",
      false,
    ),
    block(cta("Tell me the one thing", url), "24px 44px 0"),
    block(note("Or just hit reply. Both land in the same place."), "14px 44px 0"),
  ];

  return {
    subject: "What annoyed you most this week?",
    html: shell({
      preheader: "One sentence is a complete answer.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `A week in, ${name}.`,
      "",
      "I do not want a review. I want the one thing that made you frown: a slow screen, a word that would not tap, audio that started late, a button you could not find.",
      "",
      "One sentence is a complete answer.",
      "",
      `Tell me: ${url}`,
      "",
      "Or just hit reply. Both land in the same place.",
      "",
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════════ 6 · MID SURVEY */
export function buildBetaMidSurveyEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const url = data?.feedbackUrl ?? `${b}/beta/survey`;

  const blocks = [
    block(
      `${eyebrow("Three weeks in")}${head(`Three questions,<br/>${gold("ninety")} seconds.`, 40)}${lead(
        `Three weeks down, three to go. What you say now decides what I build in the second half, ${esc(name)}, so this is the moment your answers are worth the most.`,
      )}`,
      "40px 44px 0",
    ),
    block(
      card(
        `${cardTitle("What I am asking")}
        ${bullets([
          "How likely you are to recommend it, on a scale of nought to ten.",
          "The one thing you would fix before anyone else sees it.",
          "The one thing you would be sad to lose.",
        ])}`,
      ),
      "28px 44px 0",
      false,
    ),
    block(cta("Answer the three", url), "24px 44px 0"),
  ];

  return {
    subject: "Three questions, ninety seconds",
    html: shell({
      preheader: "Halfway through the beta. Your answers set the second half.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `Three weeks down, three to go, ${name}. This is the halfway point of the beta.`,
      "",
      "Three questions, ninety seconds:",
      "  1. How likely are you to recommend it, nought to ten?",
      "  2. What would you fix before anyone else sees it?",
      "  3. What would you be sad to lose?",
      "",
      `Answer here: ${url}`,
      "",
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════════ 7 · RELEASE NOTE */
// The engine of the whole program. `fixedForThem` is what turns a changelog
// into a reason to keep reporting.
export function buildBetaReleaseNoteEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const r = data?.release;
  const version = r?.version ?? "";
  const build = r?.buildNumber ?? "";
  const headline = r?.headline ?? "A new build is ready";
  const whatsNew = r?.whatsNew ?? [];
  const knownIssues = r?.knownIssues ?? [];
  const fixedForThem = data?.fixedForThem ?? [];

  const yours =
    fixedForThem.length > 0
      ? card(
          `${cardTitle("You reported this. It is fixed.", DPE.green)}
          ${bullets(fixedForThem, "green")}`,
          "rgba(95,208,163,0.32)",
        )
      : "";

  const changes = card(
    `${cardTitle(`What changed in build ${build}`)}
    ${bullets(whatsNew)}`,
  );

  const issues =
    knownIssues.length > 0
      ? card(
          `${cardTitle("Known and already on my list", DPE.gold)}
          ${bullets(knownIssues, "gold")}`,
          "rgba(252,211,77,0.26)",
        )
      : "";

  const ask = r?.askThem?.trim()
    ? card(
        `${cardTitle("If you only do one thing", DPE.sky)}
        <p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">${esc(r.askThem)}</p>`,
        "rgba(125,211,252,0.3)",
      )
    : "";

  const blocks = [
    block(
      `${eyebrow(`Build ${build}`)}${head(esc(headline), 38)}${lead(
        `TestFlight will offer you the update, ${esc(name)}. ${version ? `Version ${esc(version)}, build ${esc(build)}.` : ""}`,
      )}`,
      "40px 44px 0",
    ),
    ...(yours ? [block(yours, "28px 44px 0", false)] : []),
    block(changes, yours ? "16px 44px 0" : "28px 44px 0", false),
    ...(ask ? [block(ask, "16px 44px 0", false)] : []),
    ...(issues ? [block(issues, "16px 44px 0", false)] : []),
    block(
      `${badge(`Build ${build}`, "sky")}${note("Open TestFlight and tap Update. If it does not show yet, give it ten minutes.")}`,
      "24px 44px 0",
    ),
  ];

  return {
    subject: `Build ${build} is live: ${headline}`,
    html: shell({
      preheader:
        fixedForThem.length > 0
          ? "Something you reported is fixed in this one."
          : "Open TestFlight and tap Update.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `Build ${build} is live, ${name}.`,
      "",
      headline,
      "",
      ...(fixedForThem.length > 0
        ? ["You reported this, and it is fixed:", ...fixedForThem.map((f) => `  - ${f}`), ""]
        : []),
      `What changed in build ${build}:`,
      ...whatsNew.map((w) => `  - ${w}`),
      "",
      ...(r?.askThem ? [`If you only do one thing: ${r.askThem}`, ""] : []),
      ...(knownIssues.length > 0
        ? ["Known and already on my list:", ...knownIssues.map((k) => `  - ${k}`), ""]
        : []),
      "Open TestFlight and tap Update. If it does not show yet, give it ten minutes.",
      "",
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════════ 8 · FINAL SURVEY */
export function buildBetaFinalSurveyEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const url = data?.feedbackUrl ?? `${b}/beta/final`;

  const blocks = [
    block(
      `${eyebrow("The beta is closing")}${head(`Last ask, and the<br/>${gold("biggest")} one.`, 38)}${lead(
        `The app goes to the App Store shortly. What you say here, ${esc(name)}, is the last thing that can still change it before everyone else arrives.`,
      )}`,
      "40px 44px 0",
    ),
    block(
      card(
        `${cardTitle("Four questions")}
        ${bullets([
          "Nought to ten: how likely are you to recommend it?",
          "What finally made it click, if it did?",
          "What nearly made you delete it?",
          "What is still missing?",
        ])}`,
      ),
      "28px 44px 0",
      false,
    ),
    block(cta("Give my final answers", url), "24px 44px 0"),
    block(
      note("Thank you for the last few weeks. Being early and being honest are two different things, and you did both."),
      "16px 44px 0",
    ),
  ];

  return {
    subject: "Last ask before the app goes live",
    html: shell({
      preheader: "Four questions. The last chance to change it before launch.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `The beta is closing, ${name}, and the app goes to the App Store shortly.`,
      "",
      "Four questions:",
      "  1. Nought to ten, how likely are you to recommend it?",
      "  2. What finally made it click, if it did?",
      "  3. What nearly made you delete it?",
      "  4. What is still missing?",
      "",
      `Answer here: ${url}`,
      "",
      "Thank you for the last few weeks.",
      "",
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════════ 9 · REVIEW ASK */
// Only ever sent to testers who scored the app highly on the final survey.
// The ask names what they said, so it reads as a follow-up rather than a
// cold favour.
export function buildBetaReviewAskEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const reviewUrl = data?.reviewUrl ?? `${b}`;

  const blocks = [
    block(
      `${eyebrow("It's live")}${head(`It shipped, and<br/>you ${gold("shaped")} it.`, 38)}${lead(
        `It is out, ${esc(name)}. Digital Polyglot is on the App Store. You rated it highly a few days ago, and there is one thing that would genuinely help now.`,
      )}`,
      "40px 44px 0",
    ),
    block(
      card(
        `<p style="margin:0 0 12px;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
          A new app with no reviews is invisible. Yours is the first thing a stranger deciding whether to try it will read, and you have used it for longer than they ever will before deciding.
        </p>
        <p style="margin:0;font-family:${DPE.font};font-weight:700;font-size:15.5px;line-height:1.6;color:${DPE.fg};">
          Two sentences about what it actually did for you beats five stars and no words.
        </p>`,
      ),
      "28px 44px 0",
      false,
    ),
    block(cta("Leave a review", reviewUrl), "24px 44px 0"),
    block(note("And if you would rather not, that is genuinely fine. You already gave me the part that mattered most."), "16px 44px 0"),
  ];

  return {
    subject: "It shipped, and you shaped it",
    html: shell({
      preheader: "One review from you is worth more than any ad I could buy.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `It is out, ${name}. Digital Polyglot is on the App Store.`,
      "",
      "You rated it highly a few days ago, and there is one thing that would genuinely help: a review.",
      "",
      "A new app with no reviews is invisible. Yours is the first thing a stranger will read, and you have used it for longer than they ever will before deciding.",
      "",
      "Two sentences about what it actually did for you beats five stars and no words.",
      "",
      `Leave a review: ${reviewUrl}`,
      "",
      "And if you would rather not, that is genuinely fine.",
      "",
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════════ 10 · REVIEW RECOVER */
// The other branch. A tester who scored the app low gets asked what would
// have had to change, never asked for a review.
export function buildBetaReviewRecoverEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const url = data?.feedbackUrl ?? `${b}/beta/feedback`;

  const blocks = [
    block(
      `${eyebrow("It's live")}${head(`It shipped, but not<br/>${gold("for")} you yet.`, 38)}${lead(
        `Digital Polyglot is on the App Store. You did not rate it highly, ${esc(name)}, and that is the more useful answer of the two.`,
      )}`,
      "40px 44px 0",
    ),
    block(
      card(
        `<p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
          I am not going to ask you for a review. I want the sentence that starts with ${hi("it would have worked for me if")}. That is the roadmap.
        </p>`,
      ),
      "28px 44px 0",
      false,
    ),
    block(ctaSecondary("Tell me what was missing", url), "24px 44px 0"),
    block(note("Your access stays on either way. Thank you for sticking with a half-built app for as long as you did."), "16px 44px 0"),
  ];

  return {
    subject: "It shipped. What would have made it work for you?",
    html: shell({
      preheader: "No review ask. Just the sentence that starts with 'it would have worked if'.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `Digital Polyglot is on the App Store, ${name}.`,
      "",
      "You did not rate it highly, and that is the more useful answer of the two.",
      "",
      "I am not going to ask you for a review. I want the sentence that starts with 'it would have worked for me if'. That is the roadmap.",
      "",
      `Tell me: ${url}`,
      "",
      "Your access stays on either way.",
      "",
      "Digital Polyglot",
    ].join("\n"),
  };
}

export const BETA_EMAIL_BUILDERS: Record<BetaEmailKind, (data?: BetaEmailData) => BuiltEmail> = {
  accepted: buildBetaAcceptedEmail,
  waitlist: buildBetaWaitlistEmail,
  declined: buildBetaDeclinedEmail,
  install_nudge: buildBetaInstallNudgeEmail,
  feedback_ask: buildBetaFeedbackAskEmail,
  mid_survey: buildBetaMidSurveyEmail,
  release_note: buildBetaReleaseNoteEmail,
  final_survey: buildBetaFinalSurveyEmail,
  review_ask: buildBetaReviewAskEmail,
  review_recover: buildBetaReviewRecoverEmail,
};
