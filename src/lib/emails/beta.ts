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
  // Android gets its own acceptance mail rather than a branch inside the iOS
  // one. The two flows share no step: Apple emails the tester an invitation
  // and TestFlight does the rest, while Google emails nothing and the tester
  // has to join a group and opt in by hand. Merging them produced an email
  // that hedged on every line.
  | "accepted_android"
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
  /**
   * Android opt-in page for the closed track. Google sends the tester nothing,
   * so this link IS the invitation: without it the acceptance email is empty.
   */
  playOptInUrl?: string | null;
  /** Google Group the tester has to join before the opt-in page works. */
  playGroupJoinUrl?: string | null;
  /**
   * Which store THIS recipient installs through. Only the lifecycle emails
   * need it, and they need it badly: "open TestFlight and tap Update" is not
   * merely unhelpful to an Android tester, it is an instruction they cannot
   * follow, which reads as the program not knowing who they are.
   */
  platform?: "ios" | "android";
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
   * One or two hand-written lines for THIS person, rendered above the
   * instructions in the acceptance email. Optional: without it the email is
   * exactly what it was before.
   */
  personalNote?: string | null;
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

/**
 * Every email in this family is written in the first person: "I read every
 * one", "reply and I will resend it". Until 2026-08-11 none of them said who
 * "I" was, and the plain-text half signed off as the brand, so a personal
 * sentence arrived signed by a company. Same name `personal.ts` already uses.
 */
const SIGN_OFF = "Alejandro";

// Just the name, matching the plain-text half exactly. The brand is already
// on the footer logo directly underneath; repeating it here would put the
// company back in the signature slot, which is the thing being fixed.
function signature(): string {
  return `<div style="text-align:left;">
    <p style="margin:0;font-family:${DPE.font};font-weight:700;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">${esc(SIGN_OFF)}</p>
  </div>`;
}

/**
 * `shell` with the sign-off appended. Wrapped rather than added to the shell
 * itself: `kit.ts` is shared with the lifecycle emails, which are not written
 * in anyone's voice and must not grow a personal signature by side effect.
 */
function betaShell(opts: Parameters<typeof shell>[0]): string {
  return shell({ ...opts, blocks: [...opts.blocks, block(signature(), "26px 44px 0", false)] });
}

/* ══════════════════════════════════════════════ 1 · ACCEPTED */
// The one email that must not be vague. It has to answer, in order: am I in,
// what do I press, what do I get, and what do you want from me.
export function buildBetaAcceptedEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const tfUrl = data?.testflightUrl ?? "https://apps.apple.com/app/testflight/id899247664";

  // The one email in the program that has to tell someone how to install, and
  // the only one of the four store-aware emails that did not look at
  // `platform`. Every Android tester accepted before this read "open the
  // invite Apple just sent you" about an invite that does not exist and never
  // will: Google mails the tester nothing at all. The type has said so since
  // the field was added ("this link IS the invitation"), the sender has always
  // passed it, and only the copy never asked.
  const android = data?.platform === "android";
  const optInUrl = data?.playOptInUrl ?? null;
  const groupUrl = data?.playGroupJoinUrl ?? null;
  // With no opt-in link there is nothing to instruct an Android tester to do,
  // so say the honest thing rather than a confident wrong thing.
  const androidReady = android && !!optInUrl;

  const steps = card(
    androidReady
      ? `${cardTitle("Getting in takes about two minutes")}
    ${bullets(
      [
        ...(groupUrl
          ? ["Join the testers group first. The install link only works for accounts in it."]
          : []),
        "Open the opt-in page in a browser, not inside the Play Store app, and tap Become a tester.",
        "Install Digital Polyglot from Google Play, and sign in with this email address.",
      ],
    )}`
      : android
        ? `${cardTitle("Getting in")}
    <p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
      Your Android access is being set up. Reply to this email and I will send your install link straight away.
    </p>`
        : `${cardTitle("Getting in takes about two minutes")}
    ${bullets([
      "Install TestFlight if you do not have it yet. It is Apple's app for testing apps.",
      "Open the invite Apple just sent to your Apple ID and tap Accept.",
      "Install Digital Polyglot from there, and sign in with this email address.",
    ])}`,
  );

  const perks = card(
    `${cardTitle("While the beta runs", DPE.gold)}
    ${bullets(
      [
        "Every language, every story and the audio are open to you.",
        "Pick a language when you open the app. You can change it whenever you want.",
        "Tell me something is broken and you will hear from me when it is fixed.",
      ],
      "gold",
    )}`,
    "rgba(252,211,77,0.3)",
  );

  const ask = card(
    `${cardTitle("Then just use it", DPE.sky)}
    <p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
      When something breaks or annoys you, tap ${hi("Send feedback")} in Settings and tell me in one line. I read all of them.
    </p>`,
    "rgba(125,211,252,0.3)",
  );

  // Set apart from the templated body on purpose: a hand-written line has to
  // look hand-written, or it reads as one more generated paragraph.
  const personal = data?.personalNote?.trim()
    ? `<div style="border-left:3px solid ${DPE.gold};padding:2px 0 2px 16px;text-align:left;">
        <p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:16px;line-height:1.65;color:${DPE.fg};">${esc(
          data.personalNote.trim(),
        )}</p>
      </div>`
    : "";

  const blocks = [
    block(
      `${eyebrow("Beta access")}${head(`You're ${gold("in")}, ${esc(name)}.`, 40)}${lead(
        `Thank you for signing up. As a beta tester you help shape the app that many more people will later use to learn and improve their languages.`,
      )}${lead(
        androidReady
          ? `Your install link is below. Google does not send one, so this email is the invitation.`
          : android
            ? `One step left on my side before you can install.`
            : `Apple is sending your TestFlight invite to your Apple ID right now.`,
      )}`,
      "40px 44px 0",
    ),
    ...(personal ? [block(personal, "26px 44px 0", false)] : []),
    block(steps, "28px 44px 0", false),
    ...(androidReady
      ? [
          ...(groupUrl
            ? [block(ctaSecondary("Join the testers group", groupUrl), "24px 44px 0")]
            : []),
          block(cta("Become a tester", optInUrl!), groupUrl ? "12px 44px 0" : "24px 44px 0"),
        ]
      : android
        ? []
        : [block(cta("Open TestFlight", tfUrl), "24px 44px 0")]),
    block(perks, "24px 44px 0", false),
    block(ask, "16px 44px 0", false),
    block(
      note(
        androidReady
          ? "If the opt-in page says you are not a tester, it is almost always the Google account: open the link in a browser while signed in as the address you gave me. Reply here and I will sort it."
          : android
            ? "Reply to this email and I will send your install link."
            : "If Apple's invite has not shown up in fifteen minutes, check the spam folder of your Apple ID address, then reply here and I will send it again.",
      ),
      "8px 44px 0",
    ),
    block(lead("Thanks for being one of the first."), "18px 44px 0"),
  ];

  return {
    subject: androidReady
      ? "You're in: your install link is inside"
      : android
        ? "You're in"
        : "You're in: your TestFlight invite is on the way",
    html: betaShell({
      // The preheader is the line they read in the inbox, so it cannot promise
      // two minutes to someone who has to wait for a reply first.
      preheader: android && !androidReady
        ? "You're in. One step left on my side."
        : "Two minutes to install, then everything is unlocked.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `You are in, ${name}.`,
      "",
      ...(data?.personalNote?.trim() ? [data.personalNote.trim(), ""] : []),
      `Thank you for signing up. As a beta tester you help shape the app that many more people will later use to learn and improve their languages.`,
      "",
      ...(androidReady
        ? [
            "Your install link is below. Google does not send one, so this email is the invitation.",
            "",
            "Getting in takes about two minutes:",
            ...(groupUrl
              ? [`  1. Join the testers group: ${groupUrl}`, "     The install link only works for accounts in it."]
              : []),
            `  ${groupUrl ? 2 : 1}. Open the opt-in page in a browser, not inside the Play Store app, and tap Become a tester.`,
            `  ${groupUrl ? 3 : 2}. Install Digital Polyglot from Google Play, and sign in with this email address.`,
            "",
            `Opt-in page: ${optInUrl}`,
            "",
          ]
        : android
          ? [
              "One step left on my side before you can install. Reply to this email and I will send your install link straight away.",
              "",
            ]
          : [
              "Apple is sending your TestFlight invite to your Apple ID right now.",
              "",
              "Getting in takes about two minutes:",
              "  1. Install TestFlight if you do not have it yet. It is Apple's app for testing apps.",
              "  2. Open the invite Apple just sent and tap Accept.",
              "  3. Install Digital Polyglot from there, and sign in with this email address.",
              "",
              `TestFlight: ${tfUrl}`,
              "",
            ]),
      "Every language, every story and the audio are open to you. Pick a language when you open the app. You can change it whenever you want.",
      "",
      "Then just use it. When something breaks or annoys you, tap Send feedback in Settings and tell me in one line. I read all of them.",
      "",
      androidReady
        ? "If the opt-in page says you are not a tester, it is almost always the Google account: open the link in a browser while signed in as the address you gave me. Reply here and I will sort it."
        : android
          ? ""
          : "If Apple's invite has not shown up in fifteen minutes, check the spam folder of your Apple ID address, then reply here and I will send it again.",
      "",
      "Thanks for being one of the first.",
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════ 1b · ACCEPTED (ANDROID) */
// Google tells the tester nothing, so this email is the entire invitation.
// It also has to defuse the two traps that eat Android testers before they
// ever see the app, both of which cost a real tester on 2026-08-05:
//   - Tapping the opt-in link from a chat app hands it to the Play Store app,
//     which cannot render that page and shows an empty grey card.
//   - The Google account that joined the group has to be the one the phone's
//     Play Store is signed in with, and people rarely have only one.
export function buildBetaAcceptedAndroidEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const joinUrl = data?.playGroupJoinUrl ?? null;
  const optInUrl = data?.playOptInUrl ?? null;

  const stepList = [
    ...(joinUrl
      ? ["Join the testers group with the Google account you use on your phone. One tap, no forms."]
      : []),
    "Open the tester link in Chrome. If tapping it opens the Play Store app and you get an empty grey card, copy the link and paste it into Chrome instead.",
    "Tap Become a tester, then Download it on Google Play. The first time it can take a few minutes to appear.",
    "Sign in to the app with this email address.",
  ];

  const steps = card(`${cardTitle("Getting in takes three minutes")}${bullets(stepList)}`);

  // The single most common failure is an account mismatch, and it produces no
  // error message at all: the page just says the app is not available. Naming
  // it up front is cheaper than answering the same email five times.
  const accountWarning = card(
    `${cardTitle("The one thing that goes wrong", DPE.sky)}
    <p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
      If the page says the app is not available, you are almost certainly signed in with a different Google account than the one that joined the group. Check the avatar at the top right of Chrome, switch accounts, and open the link again.
    </p>`,
    "rgba(125,211,252,0.3)",
  );

  const perks = card(
    `${cardTitle("While the beta runs", DPE.gold)}
    ${bullets(
      [
        "Every language, every story and the audio are open to you.",
        "Pick a language when you open the app. You can change it whenever you want.",
        "Tell me something is broken and you will hear from me when it is fixed.",
      ],
      "gold",
    )}`,
    "rgba(252,211,77,0.3)",
  );

  const ask = card(
    `${cardTitle("Then just use it", DPE.sky)}
    <p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
      When something breaks or annoys you, tap ${hi("Send feedback")} in Settings and tell me in one line. I read all of them.
    </p>`,
    "rgba(125,211,252,0.3)",
  );

  const personal = data?.personalNote?.trim()
    ? `<div style="border-left:3px solid ${DPE.gold};padding:2px 0 2px 16px;text-align:left;">
        <p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:16px;line-height:1.65;color:${DPE.fg};">${esc(
          data.personalNote.trim(),
        )}</p>
      </div>`
    : "";

  const blocks = [
    block(
      `${eyebrow("Beta access")}${head(`You're ${gold("in")}, ${esc(name)}.`, 40)}${lead(
        `Thank you for signing up. As a beta tester you help shape the app that many more people will later use to learn and improve their languages.`,
      )}${lead(`Google does not send an invite of its own, so everything you need is right here.`,
      )}`,
      "40px 44px 0",
    ),
    ...(personal ? [block(personal, "26px 44px 0", false)] : []),
    block(steps, "28px 44px 0", false),
    ...(joinUrl ? [block(cta("Join the testers group", joinUrl), "24px 44px 0")] : []),
    ...(optInUrl
      ? [block(joinUrl ? ctaSecondary("Open the tester link", optInUrl) : cta("Open the tester link", optInUrl), "12px 44px 0")]
      : []),
    block(accountWarning, "24px 44px 0", false),
    block(perks, "16px 44px 0", false),
    block(ask, "16px 44px 0", false),
    block(
      note("Stuck at any step, reply and tell me what the screen says. Android's way of doing this is genuinely fiddly, and it is not your fault."),
      "8px 44px 0",
    ),
    block(lead("Thanks for being one of the first."), "18px 44px 0"),
  ];

  return {
    subject: "You're in: here is your Android tester link",
    html: betaShell({
      preheader: "Join the group, open the link in Chrome, install.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `You are in, ${name}.`,
      "",
      ...(data?.personalNote?.trim() ? [data.personalNote.trim(), ""] : []),
      `Thank you for signing up. As a beta tester you help shape the app that many more people will later use to learn and improve their languages.`,
      "",
      "Google does not send an invite of its own, so everything you need is in this email.",
      "",
      "Getting in takes three minutes:",
      ...stepList.map((s, i) => `  ${i + 1}. ${s}`),
      "",
      ...(joinUrl ? [`Testers group: ${joinUrl}`] : []),
      ...(optInUrl ? [`Tester link: ${optInUrl}`] : []),
      "",
      "The one thing that goes wrong: if the page says the app is not available, you are signed in with a different Google account than the one that joined the group. Check the avatar at the top right of Chrome and switch.",
      "",
      "Every language, every story and the audio are open to you. Pick a language when you open the app. You can change it whenever you want.",
      "",
      "Then just use it. When something breaks or annoys you, tap Send feedback in Settings and tell me in one line. I read all of them.",
      "",
      "Stuck at any step, reply and tell me what the screen says.",
      "",
      "Thanks for being one of the first.",
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════════ 2 · WAITLIST */
// Honest about the reason. A waitlist email that pretends to be an acceptance
// burns the applicant twice.
export function buildBetaWaitlistEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");

  const blocks = [
    block(
      `${eyebrow("Application received")}${head(`You're on the<br/>${gold("shortlist")}.`, 40)}${lead(
        `Thanks for applying, ${esc(name)}. I run the beta in small groups so every report gets read properly, which means invites go out in waves.`,
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
    html: betaShell({
      preheader: "Invites go out in waves. You keep your place.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `Thanks for applying, ${name}.`,
      "",
      `I run the beta in small groups so every report gets read properly, which means invites go out in waves.`,
      "",
      "You keep your place, there is nothing to reapply for, and invites go out oldest first when the next wave opens. You will hear from me either way.",
      "",
      SIGN_OFF,
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
        `Thanks for applying, ${esc(name)}. The current beta is a small group, and your application is not a fit for this round.`,
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
    html: betaShell({
      preheader: "Not a fit for this round. Here is what you can do today.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `Thanks for applying, ${name}.`,
      "",
      "The current beta is a small group, and your application is not a fit for this round.",
      "",
      `You can read on the web today at no cost: ${b}/stories`,
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════════ 4 · INSTALL NUDGE */
// Sent when the invite went out and nothing happened. Assumes friction, not
// disinterest, because that is what it usually is.
export function buildBetaInstallNudgeEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const android = data?.platform === "android";
  const tfUrl = data?.testflightUrl ?? "https://apps.apple.com/app/testflight/id899247664";
  const optInUrl = data?.playOptInUrl ?? null;

  // The two ways each store loses a tester, and they have nothing in common.
  // On iOS the invitation is an email that landed somewhere they do not read.
  // On Android there is no email at all, and the loss happens on the opt-in
  // page: wrong Google account, or the Play Store app swallowing the link.
  const reasons = android
    ? [
        "You are signed in with a different Google account than the one on the testers list. The page just says the app is not available, with no hint that this is why.",
        "Tapping the link opened the Play Store app instead of a browser, and it showed an empty grey card. Paste the link into Chrome instead.",
      ]
    : [
        "The invite went to your Apple ID address, which is often not the address you are reading this on. Check that inbox and its spam folder.",
        "TestFlight itself was never installed. It is a free Apple app, and the invite link does nothing without it.",
      ];

  const ctaUrl = android ? optInUrl : tfUrl;
  const ctaLabel = android ? "Open the tester link" : "Install TestFlight";

  const blocks = [
    block(
      `${eyebrow("Your spot is still open")}${head(`Stuck on the<br/>${gold("install")}?`, 40)}${lead(
        android
          ? `Hi ${esc(name)}. Your tester link went out a few days ago and it looks like the app never opened. Android's testing flow is genuinely fiddly, so it is very likely the flow and not you.`
          : `Hi ${esc(name)}. Your TestFlight invite went out a few days ago and it looks like the app never opened. That is usually Apple's email, not you.`,
      )}`,
      "40px 44px 0",
    ),
    block(card(`${cardTitle("The two things that go wrong")}${bullets(reasons)}`), "28px 44px 0", false),
    ...(ctaUrl ? [block(cta(ctaLabel, ctaUrl), "24px 44px 0")] : []),
    block(
      note(
        android
          ? "Still stuck? Reply and tell me exactly what the page says, and which Google account you are signed in with."
          : "Still stuck? Reply with the Apple ID address you want it sent to and I will fire a fresh invite.",
      ),
      "16px 44px 0",
    ),
  ];

  return {
    subject: "Your beta spot is still open",
    html: betaShell({
      preheader: android
        ? "It is almost always the wrong Google account."
        : "The invite is usually sitting in your Apple ID inbox.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `Hi ${name}.`,
      "",
      android
        ? "Your tester link went out a few days ago and it looks like the app never opened. Two things usually explain it:"
        : "Your TestFlight invite went out a few days ago and it looks like the app never opened. Two things usually explain it:",
      "",
      ...reasons.map((r, i) => `  ${i + 1}. ${r}`),
      "",
      ...(ctaUrl ? [`${ctaLabel}: ${ctaUrl}`] : []),
      "",
      android
        ? "Still stuck? Reply and tell me what the page says, and which Google account you are signed in with."
        : "Still stuck? Reply with the Apple ID address you want it sent to and I will fire a fresh invite.",
      "",
      SIGN_OFF,
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
    html: betaShell({
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
      SIGN_OFF,
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
        `Three weeks down, three to go. What you say now decides what gets built in the second half, ${esc(name)}, so this is the moment your answers are worth the most.`,
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
    html: betaShell({
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
      SIGN_OFF,
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
  const build = r?.buildNumber ?? "";
  const headline = r?.headline ?? "A new version is ready";
  const whatsNew = r?.whatsNew ?? [];
  const knownIssues = r?.knownIssues ?? [];
  const fixedForThem = data?.fixedForThem ?? [];

  // Same build, two different apps to tap Update in. Naming the wrong one is
  // a small error that reads as a large one: it tells the reader the program
  // does not know which phone they are on.
  const android = data?.platform === "android";
  const updateSource = android ? "Google Play" : "TestFlight";
  const updateInstruction = android
    ? "Open Google Play and tap Update."
    : "Open TestFlight and tap Update.";

  const yours =
    fixedForThem.length > 0
      ? card(
          `${cardTitle("You reported this. It is fixed.", DPE.green)}
          ${bullets(fixedForThem, "green")}`,
          "rgba(95,208,163,0.32)",
        )
      : "";

  const changes = card(
    `${cardTitle("What changed in this one")}
    ${bullets(whatsNew)}`,
  );

  const issues =
    knownIssues.length > 0
      ? card(
          `${cardTitle("Known and already on the list", DPE.gold)}
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
      `${eyebrow("New version")}${head(esc(headline), 38)}${lead(
        `${updateSource} will offer you the update, ${esc(name)}.`,
      )}`,
      "40px 44px 0",
    ),
    ...(yours ? [block(yours, "28px 44px 0", false)] : []),
    block(changes, yours ? "16px 44px 0" : "28px 44px 0", false),
    ...(ask ? [block(ask, "16px 44px 0", false)] : []),
    ...(issues ? [block(issues, "16px 44px 0", false)] : []),
    block(
      `${badge(`Build ${build}`, "sky")}${note(`${updateInstruction} If it does not show yet, give it ten minutes.`)}`,
      "24px 44px 0",
    ),
  ];

  return {
    subject: `New version: ${headline}`,
    html: betaShell({
      preheader:
        fixedForThem.length > 0
          ? "Something you reported is fixed in this one."
          : updateInstruction,
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `There is a new version, ${name}.`,
      "",
      headline,
      "",
      ...(fixedForThem.length > 0
        ? ["You reported this, and it is fixed:", ...fixedForThem.map((f) => `  - ${f}`), ""]
        : []),
      "What changed in this one:",
      ...whatsNew.map((w) => `  - ${w}`),
      "",
      ...(r?.askThem ? [`If you only do one thing: ${r.askThem}`, ""] : []),
      ...(knownIssues.length > 0
        ? ["Known and already on the list:", ...knownIssues.map((k) => `  - ${k}`), ""]
        : []),
      `${updateInstruction} If it does not show yet, give it ten minutes.`,
      "",
      SIGN_OFF,
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
    html: betaShell({
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
      SIGN_OFF,
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
  // Third time this bites: an Android tester sent to the App Store cannot act
  // on the ask at all. Same fix as the install nudge and the build note.
  const store = data?.platform === "android" ? "Google Play" : "the App Store";

  const blocks = [
    block(
      `${eyebrow("It's live")}${head(`It shipped, and<br/>you ${gold("shaped")} it.`, 38)}${lead(
        `It is out, ${esc(name)}. Digital Polyglot is on ${esc(store)}. You rated it highly a few days ago, and there is one thing that would genuinely help now.`,
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
    html: betaShell({
      preheader: "One review from you is worth more than any ad I could buy.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      `It is out, ${name}. Digital Polyglot is on ${store}.`,
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
      SIGN_OFF,
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
    html: betaShell({
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
      SIGN_OFF,
    ].join("\n"),
  };
}

export const BETA_EMAIL_BUILDERS: Record<BetaEmailKind, (data?: BetaEmailData) => BuiltEmail> = {
  accepted: buildBetaAcceptedEmail,
  accepted_android: buildBetaAcceptedAndroidEmail,
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
