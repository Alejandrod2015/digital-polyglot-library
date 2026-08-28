// Beta program email compositions. Same design system as the lifecycle sends
// (src/lib/emails/kit.ts) so a tester never sees two different products.
//
// The through-line across all of them: a beta tester is doing the product a
// favour, so every send is specific about what it asks or about what is new.
// Ninguno dice "we value your feedback" sin enseñar algo, y ninguno cuenta la
// mejora como el pago de un favor: se agradece el mensaje y se enseña el
// trabajo, sin atribuirle la decision a quien escribio.

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
  phoneShot,
} from "./kit";
import { publicBaseUrl } from "@/lib/emails/publicBaseUrl";
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
  | "review_recover"
  // Not a build note and not a survey: the send that shows a piece of work
  // the product is proud of. Kept apart from `release_note` because it is not
  // tied to a build and must not carry "open TestFlight and tap Update".
  | "improvement";

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
   * Los arreglos de este build que tocan a ESTE lector, para que no se le
   * pierdan entre los demas. Se listan como arreglos, nunca como deuda
   * saldada con quien los reporto.
   */
  fixedForThem?: string[];
  /**
   * The "we heard you" send. Everything in it is data, not copy baked into
   * the builder, so the same email can carry a different piece of work next
   * time without a second builder.
   *
   * La mitad personal es `quote` + `highlights`: con ellos el correo va
   * dirigido a quien escribio, y sin ellos es la misma noticia para todos los
   * demas. No hay un tercer modo, a proposito: un correo a medias ("some of
   * you mentioned...") es justo lo que este programa no manda.
   */
  improvement?: {
    /** Overrides the headline. The default answers "what got better". */
    headline?: string | null;
    /** Overrides the subject line. */
    subject?: string | null;
    /** What changed, for every tester. The body of the news. */
    changes: string[];
    /** Sus palabras, literales. Citar es TODA la personalizacion: se agradece
     *  el mensaje, no se le atribuye la decision de construir. */
    quote?: string | null;
    /** When they wrote it, e.g. "in your final survey, 23 August". */
    quotedAt?: string | null;
    /** Lo que hace la app ahora, contado en los terminos de esta persona. */
    highlights?: string[];
    /**
     * One word from a story THEY read, before and after. Abstract claims about
     * definitions are cheap; a word they tapped and the two versions of what
     * it said is the proof.
     */
    example?: {
      word: string;
      /** La frase de la historia donde sale, para situarla. */
      sentence?: string | null;
      /** Lo que la tarjeta dice ahora, en una linea. */
      caption: string;
      /**
       * La captura o la animacion de la tarjeta, servida desde `assetBase`
       * (public/email/...). Se enseña solo el ESTADO NUEVO: un "antes" pone al
       * lector a mirar lo que ya no existe.
       */
      image?: string | null;
      /** Version fija y a tamaño real, para el enlace de debajo. */
      fullSizeImage?: string | null;
    } | null;

    /** The one thing to go and try. */
    askThem?: string | null;
    /** Where the change is live. Defaults to the web reader. */
    ctaUrl?: string | null;
    ctaLabel?: string | null;
  };

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
  return publicBaseUrl(data?.baseUrl);
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
 * The body of every email in this family speaks as "we", never as "I": "we
 * read all of them", "reply and we will send it again". The signature is the
 * one place a person appears, and it stays: a name under a mail that says
 * "we" reads as someone answering for the team, which is what happens.
 *
 * WHY: hasta el 2026-08-26 estos correos hablaban en primera persona del
 * singular y uno de ellos llegó a encabezar un bloque con "What you told me".
 * El usuario: "Nunca hables de mí. Nunca personalices. Siempre nosotros".
 * Mismo nombre que ya usa `personal.ts`.
 */
const SIGN_OFF = "Alejandro";

// Just the name, matching the plain-text half exactly. The brand is already
// on the footer logo directly underneath; repeating it here would put the
// company back in the signature slot, which is the thing being fixed.
//
// Centrada y sobre una raya corta: alineada a la izquierda quedaba colgando
// bajo un cierre centrado, como si se hubiera caido del parrafo anterior.
function signature(): string {
  return `<div style="text-align:center;">
    <div style="width:34px;height:1px;background:${DPE.hair};margin:0 auto 14px;"></div>
    <p style="margin:0;font-family:${DPE.font};font-weight:700;font-size:15px;line-height:1.6;color:${DPE.muted};">${esc(SIGN_OFF)}</p>
  </div>`;
}

/**
 * `shell` with the sign-off appended. Wrapped rather than added to the shell
 * itself: `kit.ts` is shared with the lifecycle emails, which are not written
 * in anyone's voice and must not grow a personal signature by side effect.
 */
function betaShell(opts: Parameters<typeof shell>[0]): string {
  return shell({ ...opts, blocks: [...opts.blocks, block(signature(), "30px 24px 0")] });
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
      Your Android access is being set up. Reply to this email and we will send your install link straight away.
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
        "Tell us something is broken and you will hear back when it is fixed.",
      ],
      "gold",
    )}`,
    "rgba(252,211,77,0.3)",
  );

  const ask = card(
    `${cardTitle("Then just use it", DPE.sky)}
    <p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
      When something breaks or annoys you, tap ${hi("Send feedback")} in Settings and tell us in one line. We read all of them.
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
            ? `One step left on our side before you can install.`
            : `Apple is sending your TestFlight invite to your Apple ID right now.`,
      )}`,
      "40px 24px 0",
    ),
    ...(personal ? [block(personal, "26px 24px 0", false)] : []),
    block(steps, "28px 24px 0", false),
    ...(androidReady
      ? [
          ...(groupUrl
            ? [block(ctaSecondary("Join the testers group", groupUrl), "24px 24px 0")]
            : []),
          block(cta("Become a tester", optInUrl!), groupUrl ? "12px 24px 0" : "24px 24px 0"),
        ]
      : android
        ? []
        : [block(cta("Open TestFlight", tfUrl), "24px 24px 0")]),
    block(perks, "24px 24px 0", false),
    block(ask, "16px 24px 0", false),
    block(
      note(
        androidReady
          ? "If the opt-in page says you are not a tester, it is almost always the Google account: open the link in a browser while signed in as the address you gave us. Reply here and we will sort it."
          : android
            ? "Reply to this email and we will send your install link."
            : "If Apple's invite has not shown up in fifteen minutes, check the spam folder of your Apple ID address, then reply here and we will send it again.",
      ),
      "8px 24px 0",
    ),
    block(lead("Thanks for being one of the first."), "18px 24px 0"),
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
        ? "You're in. One step left on our side."
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
              "One step left on our side before you can install. Reply to this email and we will send your install link straight away.",
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
      "Then just use it. When something breaks or annoys you, tap Send feedback in Settings and tell us in one line. We read all of them.",
      "",
      androidReady
        ? "If the opt-in page says you are not a tester, it is almost always the Google account: open the link in a browser while signed in as the address you gave us. Reply here and we will sort it."
        : android
          ? ""
          : "If Apple's invite has not shown up in fifteen minutes, check the spam folder of your Apple ID address, then reply here and we will send it again.",
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
        "Tell us something is broken and you will hear back when it is fixed.",
      ],
      "gold",
    )}`,
    "rgba(252,211,77,0.3)",
  );

  const ask = card(
    `${cardTitle("Then just use it", DPE.sky)}
    <p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
      When something breaks or annoys you, tap ${hi("Send feedback")} in Settings and tell us in one line. We read all of them.
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
      "40px 24px 0",
    ),
    ...(personal ? [block(personal, "26px 24px 0", false)] : []),
    block(steps, "28px 24px 0", false),
    ...(joinUrl ? [block(cta("Join the testers group", joinUrl), "24px 24px 0")] : []),
    ...(optInUrl
      ? [block(joinUrl ? ctaSecondary("Open the tester link", optInUrl) : cta("Open the tester link", optInUrl), "12px 24px 0")]
      : []),
    block(accountWarning, "24px 24px 0", false),
    block(perks, "16px 24px 0", false),
    block(ask, "16px 24px 0", false),
    block(
      note("Stuck at any step, reply and tell us what the screen says. Android's way of doing this is genuinely fiddly, and it is not your fault."),
      "8px 24px 0",
    ),
    block(lead("Thanks for being one of the first."), "18px 24px 0"),
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
      "Then just use it. When something breaks or annoys you, tap Send feedback in Settings and tell us in one line. We read all of them.",
      "",
      "Stuck at any step, reply and tell us what the screen says.",
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
        `Thanks for applying, ${esc(name)}. We run the beta in small groups so every report gets read properly, which means invites go out in waves.`,
      )}`,
      "40px 24px 0",
    ),
    block(
      card(
        `${cardTitle("What happens next")}
        ${bullets([
          "You keep your place. There is nothing to reapply for.",
          "When the next wave opens, invites go out oldest first.",
          "You will hear from us either way. No silent rejections.",
        ])}`,
      ),
      "28px 24px 0",
      false,
    ),
    block(
      note("Nothing to do in the meantime. If your situation changes, or you have a question, just reply to this email."),
      "20px 24px 0",
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
      `We run the beta in small groups so every report gets read properly, which means invites go out in waves.`,
      "",
      "You keep your place, there is nothing to reapply for, and invites go out oldest first when the next wave opens. You will hear from us either way.",
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
      "40px 24px 0",
    ),
    block(
      card(
        `<p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
          That is about the shape of this round, not about you. You can read on the web today at no cost, and we will write when the app opens up properly.
        </p>`,
      ),
      "28px 24px 0",
      false,
    ),
    block(ctaSecondary("Read on the web", `${b}/explore`), "24px 24px 0"),
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
      `You can read on the web today at no cost: ${b}/explore`,
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
      "40px 24px 0",
    ),
    block(card(`${cardTitle("The two things that go wrong")}${bullets(reasons)}`), "28px 24px 0", false),
    ...(ctaUrl ? [block(cta(ctaLabel, ctaUrl), "24px 24px 0")] : []),
    block(
      note(
        android
          ? "Still stuck? Reply and tell us exactly what the page says, and which Google account you are signed in with."
          : "Still stuck? Reply with the Apple ID address you want it sent to and we will send a fresh invite.",
      ),
      "16px 24px 0",
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
        ? "Still stuck? Reply and tell us what the page says, and which Google account you are signed in with."
        : "Still stuck? Reply with the Apple ID address you want it sent to and we will send a fresh invite.",
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
        `A week in, ${esc(name)}. We do not want a review. We want the one thing that made you frown.`,
      )}`,
      "40px 24px 0",
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
      "28px 24px 0",
      false,
    ),
    block(cta("Tell us the one thing", url), "24px 24px 0"),
    block(note("Or just hit reply. Both land in the same place."), "14px 24px 0"),
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
      "We do not want a review. We want the one thing that made you frown: a slow screen, a word that would not tap, audio that started late, a button you could not find.",
      "",
      "One sentence is a complete answer.",
      "",
      `Tell us: ${url}`,
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
  const url = data?.feedbackUrl ?? `${b}/beta/feedback?kind=mid_survey`;

  const blocks = [
    block(
      `${eyebrow("Three weeks in")}${head(`Three questions,<br/>${gold("ninety")} seconds.`, 40)}${lead(
        `Three weeks down, three to go. What you say now decides what gets built in the second half, ${esc(name)}, so this is the moment your answers are worth the most.`,
      )}`,
      "40px 24px 0",
    ),
    block(
      card(
        `${cardTitle("What we are asking")}
        ${bullets([
          "How likely you are to recommend it, on a scale of nought to ten.",
          "The one thing you would fix before anyone else sees it.",
          "The one thing you would be sad to lose.",
        ])}`,
      ),
      "28px 24px 0",
      false,
    ),
    block(cta("Answer the three", url), "24px 24px 0"),
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
// `fixedForThem` son los arreglos que tocan a ESTE lector, listados aparte
// para que no se le pierdan en el changelog. Se enseña lo arreglado, no la
// factura de quien lo dijo (ver la regla del mensaje en el builder 12).
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
          `${cardTitle("Fixed in this build", DPE.green)}
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
      "40px 24px 0",
    ),
    ...(yours ? [block(yours, "28px 24px 0", false)] : []),
    block(changes, yours ? "16px 24px 0" : "28px 24px 0", false),
    ...(ask ? [block(ask, "16px 24px 0", false)] : []),
    ...(issues ? [block(issues, "16px 24px 0", false)] : []),
    block(
      `${badge(`Build ${build}`, "sky")}${note(`${updateInstruction} If it does not show yet, give it ten minutes.`)}`,
      "24px 24px 0",
    ),
  ];

  return {
    subject: `New version: ${headline}`,
    html: betaShell({
      preheader:
        fixedForThem.length > 0
          ? "Something you mentioned is fixed in this one."
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
        ? ["Fixed in this build:", ...fixedForThem.map((f) => `  - ${f}`), ""]
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
  const url = data?.feedbackUrl ?? `${b}/beta/feedback?kind=final_survey`;

  const blocks = [
    block(
      `${eyebrow("The beta is closing")}${head(`Last ask, and the<br/>${gold("biggest")} one.`, 38)}${lead(
        `The app goes to the App Store shortly. What you say here, ${esc(name)}, is the last thing that can still change it before everyone else arrives.`,
      )}`,
      "40px 24px 0",
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
      "28px 24px 0",
      false,
    ),
    block(cta("Give my final answers", url), "24px 24px 0"),
    block(
      note("Thank you for the last few weeks. Being early and being honest are two different things, and you did both."),
      "16px 24px 0",
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
      "40px 24px 0",
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
      "28px 24px 0",
      false,
    ),
    block(cta("Leave a review", reviewUrl), "24px 24px 0"),
    block(note("And if you would rather not, that is genuinely fine. You already gave us the part that mattered most."), "16px 24px 0"),
  ];

  return {
    subject: "It shipped, and you shaped it",
    html: betaShell({
      preheader: "One review from you is worth more than any ad we could buy.",
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
      "40px 24px 0",
    ),
    block(
      card(
        `<p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">
          We are not going to ask you for a review. We want the sentence that starts with ${hi("it would have worked for me if")}. That is the roadmap.
        </p>`,
      ),
      "28px 24px 0",
      false,
    ),
    block(ctaSecondary("Tell us what was missing", url), "24px 24px 0"),
    block(note("Your access stays on either way. Thank you for sticking with a half-built app for as long as you did."), "16px 24px 0"),
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
      "We are not going to ask you for a review. We want the sentence that starts with 'it would have worked for me if'. That is the roadmap.",
      "",
      `Tell us: ${url}`,
      "",
      "Your access stays on either way.",
      "",
      SIGN_OFF,
    ].join("\n"),
  };
}

/* ══════════════════════════════════════════════ 12 · IMPROVEMENT */
// The counterpart to `release_note`: that one is tied to a build, this one to
// a piece of work worth a mail of its own.
//
// REGLA DEL MENSAJE (2026-08-26, y la unica que importa aqui): el correo
// cuenta una mejora del producto y agradece el feedback, pero NUNCA presenta
// el feedback como la causa del cambio. Ni "you asked for this", ni "a
// tester's feedback pointed at it, so we built it". La decision de construir
// es del producto; el feedback se agradece y se cita, no se cobra.
//
// Dos formas del mismo correo. A quien escribio, se le agradece y se le cita;
// a todos los demas les llega la misma noticia sin cita. Nada mas cambia.
export function buildBetaImprovementEmail(data?: BetaEmailData): BuiltEmail {
  const b = base(data);
  const name = firstNameOr(data, "there");
  const h = data?.improvement;
  const quote = h?.quote?.trim() ?? "";
  const highlights = (h?.highlights ?? []).filter((line) => line.trim().length > 0);
  const changes = (h?.changes ?? []).filter((line) => line.trim().length > 0);
  const example = h?.example ?? null;
  const personal = quote.length > 0 || highlights.length > 0;

  // El titular dice QUE se resuelve, no como: el mecanismo se cuenta en el
  // bloque de abajo y se ve en las capturas. Un titular que describe la
  // implementacion obliga a leerlo dos veces para saber si te importa.
  const headline = h?.headline?.trim() || "Something new to try";

  // UN solo boton, y el destino lo decide `/go/app` mirando el dispositivo
  // DESDE EL QUE SE ABRE el correo: iPhone y Android van a la app (con la
  // tienda de respaldo si no la tienen) y el escritorio al lector web. En el
  // correo no se puede ramificar por dispositivo, solo por lo que el tester
  // declaro al apuntarse, que es justo lo que falla cuando lee en otro.
  const ctaUrl = h?.ctaUrl ?? `${b}/go/app`;
  const ctaLabel = h?.ctaLabel ?? "Open a story and tap a word";

  // Their sentence, set as a quote rather than paraphrased. A paraphrase is
  // where "we value your feedback" comes from: it always ends up describing
  // the complaint in the product's vocabulary instead of theirs.
  const said = quote
    ? card(
        `${cardTitle("Your feedback", DPE.sky)}
        <p style="margin:0;font-family:${DPE.font};font-weight:600;font-style:italic;font-size:15.5px;line-height:1.6;color:${DPE.fg};border-left:3px solid ${DPE.sky};padding-left:14px;">${esc(quote)}</p>
        ${h?.quotedAt ? note(esc(h.quotedAt)) : ""}`,
        "rgba(125,211,252,0.3)",
      )
    : "";

  const yours =
    highlights.length > 0
      ? card(
          `${cardTitle("What we built", DPE.green)}
          ${bullets(highlights, "green")}`,
          "rgba(95,208,163,0.32)",
        )
      : "";

  const everyone =
    changes.length > 0
      ? card(
          `${cardTitle(personal ? "Also in this update" : "What we built")}
          ${bullets(changes)}`,
        )
      : "";

  // Before and after on one word. Two rows, the old line struck through, so
  // the difference is visible without reading a sentence about it.
  // Las capturas se guardan como ruta ("/email/glosses/x.png") y se sirven
  // desde `assetBase`, igual que el logo: una URL absoluta escrita a mano
  // apuntaria a produccion incluso en la previsualizacion.
  const shotUrl = (path: string | null | undefined): string | null =>
    !path ? null : path.startsWith("http") ? path : `${assetBase(data)}${path}`;

  // El ejemplo: la tarjeta nueva dentro del telefono, y debajo la misma frase
  // en texto. La linea se queda aunque haya imagen: media bandeja de entrada
  // abre con las imagenes apagadas, y una prueba que no se ve no prueba nada.
  const shown = example
    ? card(
        `${cardTitle("One example, out of every word in the journey", DPE.gold)}
        <div style="font-family:${DPE.font};font-weight:900;font-size:20px;color:${DPE.fg};">${esc(example.word)}</div>
        ${
          example.sentence
            ? `<div style="font-family:${DPE.font};font-weight:600;font-size:13.5px;color:${DPE.muted};margin-top:2px;">${esc(example.sentence)}</div>`
            : ""
        }
        ${
          shotUrl(example.image)
            ? `<div style="margin-top:18px;text-align:center;">${phoneShot(
                shotUrl(example.image)!,
                `Tapping ${example.word} in a story`,
                // 248 y no 272: con el marco (16px) y los margenes de la
                // tarjeta, un telefono mas ancho sacaba el correo de una
                // pantalla de 375px.
                248,
              )}</div>`
            : ""
        }
        <div style="margin-top:14px;text-align:center;font-family:${DPE.font};font-weight:700;font-size:14.5px;line-height:1.45;color:${DPE.fg};">${esc(example.caption)}</div>`,
        "rgba(252,211,77,0.26)",
      )
    : "";

  const ask = h?.askThem?.trim()
    ? card(
        `${cardTitle("Give it a try", DPE.sky)}
        <p style="margin:0;font-family:${DPE.font};font-weight:600;font-size:15.5px;line-height:1.6;color:${DPE.fgSoft};">${esc(h.askThem)}</p>`,
        "rgba(125,211,252,0.3)",
      )
    : "";

  const blocks = [
    block(
      `${eyebrow(personal ? "Thank you for the feedback" : "What is new")}${head(esc(headline), 38)}${lead(
        personal
          ? `Thank you for writing to us, ${esc(name)}. We read every message, and this is an improvement we wanted to get right, for you and for everyone learning with us.`
          : `We have been working on how words explain themselves while you read, ${esc(name)}. Here is what is new.`,
      )}`,
      "40px 24px 0",
    ),
    ...(said ? [block(said, "28px 24px 0", false)] : []),
    // Primero lo que hace la app ahora, y solo despues una palabra que lo
    // ensena. Al reves, el correo parece ir de esa palabra.
    ...(yours ? [block(yours, said ? "16px 24px 0" : "28px 24px 0", false)] : []),
    ...(everyone && !yours ? [block(everyone, said ? "16px 24px 0" : "28px 24px 0", false)] : []),
    ...(shown ? [block(shown, "16px 24px 0", false)] : []),
    ...(everyone && yours ? [block(everyone, "16px 24px 0", false)] : []),
    ...(ask ? [block(ask, "16px 24px 0", false)] : []),
    block(cta(ctaLabel, ctaUrl), "26px 24px 0"),
    block(
      note(
        personal
          ? "Thank you again for the feedback. If you have more, we are right here: just reply."
          : "If you have feedback of your own, we are right here: just reply.",
      ),
      "18px 24px 0",
    ),
  ];

  return {
    subject:
      h?.subject?.trim() ||
      (personal
        ? "Thank you for the feedback. Here is what we built."
        : `What is new: ${headline.toLowerCase()}`),
    html: betaShell({
      preheader: personal
        ? "Thank you for the feedback. Here is what is new."
        : "Here is what is new in the reader.",
      blocks,
      baseUrl: b,
      assetBase: assetBase(data),
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      personal
        ? `Thank you for writing to us, ${name}. We read every message, and this is an improvement we wanted to get right, for you and for everyone learning with us.`
        : `We have been working on how words explain themselves while you read, ${name}. Here is what is new.`,
      "",
      headline,
      "",
      ...(quote ? [`Your feedback:`, `  "${quote}"`, ...(h?.quotedAt ? [`  (${h.quotedAt})`] : []), ""] : []),
      ...(highlights.length > 0
        ? ["What we built:", ...highlights.map((line) => `  - ${line}`), ""]
        : changes.length > 0
          ? ["What we built:", ...changes.map((line) => `  - ${line}`), ""]
          : []),
      ...(example
        ? [
            `One example, out of every word in the journey: ${example.word}`,
            ...(example.sentence ? [`  ${example.sentence}`] : []),
            `  ${example.caption}`,
            "",
          ]
        : []),
      ...(changes.length > 0 && highlights.length > 0
        ? ["Also in this update:", ...changes.map((line) => `  - ${line}`), ""]
        : []),
      ...(h?.askThem ? [`Give it a try: ${h.askThem}`, ""] : []),
      `${ctaLabel}: ${ctaUrl}`,
      "",
      personal
        ? "Thank you again for the feedback. If you have more, we are right here: just reply."
        : "If you have feedback of your own, we are right here: just reply.",
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
  improvement: buildBetaImprovementEmail,
};
