// Digital Polyglot lifecycle email compositions (the 9 sends).
// Ported from design/design_handoff_lifecycle_emails (lifecycle-emails.jsx).
// Each builder returns { subject, html, text }. Copy is the definitive EN copy
// from the handoff and ships as written. Dynamic merge fields have mock
// defaults so a no-arg call renders the reference design.

import {
  DPE,
  EMAIL_ASSET_BASE,
  shell,
  block,
  eyebrow,
  head,
  gold,
  lead,
  cta,
  hi,
  badge,
  logoImg,
  statTile,
  statChip,
  storyCardH,
  storyCardV,
  vocabCard,
  audioBar,
  phoneFrame,
  cols,
} from "./kit";

export type StoryRef = {
  id?: string;
  title: string;
  level?: string;
  minutes?: number;
  coverUrl: string;
};

export type LifecycleData = {
  baseUrl?: string;
  assetBase?: string;
  firstStory?: {
    id?: string;
    title: string;
    level?: string;
    minutes?: number;
    coverUrl: string;
    teaser?: string;
    percentRead?: number;
    minutesLeft?: number;
  };
  stats?: {
    wordsSeen?: number;
    minutes?: number;
    storiesCount?: number;
    wordsCount?: number;
    daysActive?: number;
    weekDays?: boolean[];
  };
  nextStories?: StoryRef[];
  newStories?: StoryRef[];
  libraryCovers?: string[];
};

export type BuiltEmail = { subject: string; html: string; text: string };

function base(data?: LifecycleData): string {
  return data?.baseUrl ?? process.env.APP_BASE_URL ?? "https://digitalpolyglot.com";
}
/** Image host (links use `base`, but images must come from a host that serves
 * static assets without redirecting; the apex domain 307s). */
function assetBase(data?: LifecycleData): string {
  return data?.assetBase ?? EMAIL_ASSET_BASE;
}
function cover(slug: string, data?: LifecycleData): string {
  return `${assetBase(data)}/covers/${slug}.jpg`;
}

/* ============================================================ 1 · WELCOME */
export function buildWelcomeEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const href = `${b}/stories/il-pranzo-di-famiglia`;
  // Animated reader GIF showing karaoke in action
  const readerGifUrl = `${ab}/email/welcome-reader.gif`;

  const blocks = [
    block(`${eyebrow("Welcome to Digital Polyglot")}${head(`Tap a word.<br/>${gold("It clicks.")}`, 40)}${lead(
      "Your first short story is ready. Read it, tap any word for the meaning and native audio, and the language starts to make sense."
    )}`, "40px 44px 0"),
    block(`<div style="text-align:center;"><img src="${readerGifUrl}" alt="animated reader with karaoke highlight" width="360" height="760" style="width:100%;max-width:360px;height:auto;border-radius:48px;border:1px solid rgba(125,211,252,0.16);box-shadow:0 20px 48px -18px rgba(0,0,0,0.8);" /></div>`, "28px 20px 4px"),
    block(`${cta("Open your first story", href)}<div style="margin-top:13px;font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};">About 4 minutes &middot; picked for your level</div>`, "24px 44px 0"),
  ];

  return {
    subject: "Welcome to Digital Polyglot 👋",
    html: shell({ preheader: "Your first short story is ready. Tap a word, and it clicks.", blocks, baseUrl: b, assetBase: ab }),
    text: [
      "Welcome to Digital Polyglot.",
      "",
      "Your first short story is ready. Read it, tap any word for the meaning and native audio, and the language starts to make sense.",
      "",
      `Open your first story: ${href}`,
      "About 4 minutes, picked for your level.",
      "",
      "Questions? Just reply to this email.",
      "— Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 2 · NUDGE */
export function buildNudgeEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const s = data?.firstStory ?? {
    title: "Mole en San Ángel",
    level: "Beginner",
    minutes: 4,
    coverUrl: cover("ss-es-mx", data),
    teaser: "Es jueves al mediodía. La fonda de San Ángel huele a mole.",
    percentRead: 38,
    minutesLeft: 2,
  };
  const href = s.id ? `${b}/?story=${encodeURIComponent(s.id)}` : `${b}/?welcome=1`;
  const pct = s.percentRead ?? 38;
  const blocks = [
    block(`${eyebrow("Pick up where you left off", DPE.sky)}${head(`It clicks faster<br/>than you ${gold("think.")}`, 37)}${lead(
      "Your first story takes about 4 minutes, and you are already partway in. Finish it and you will feel the difference."
    )}`, "44px 44px 0"),
    block(storyCardH({
      cover: s.coverUrl,
      title: s.title,
      level: s.level,
      meta: `· ${s.minutes ?? 4} min · audio`,
      teaser: s.teaser,
      pct,
      pctLabel: `${pct}% read · about ${s.minutesLeft ?? 2} min left`,
    }), "28px 44px 0", false),
    block(cta("Finish your first story", href), "26px 44px 0"),
  ];
  return {
    subject: "Your first story takes about 4 minutes",
    html: shell({ preheader: "You are already partway in. Finish it and you will feel the difference.", blocks, baseUrl: b, assetBase: ab }),
    text: [
      "Pick up where you left off.",
      "",
      "Your first story takes about 4 minutes, and you are already partway in. Finish it and you will feel the difference.",
      "",
      `Finish your first story: ${href}`,
      "— Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 3 · CELEBRATION */
export function buildCelebrationEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const href = `${b}/?next=1`;
  const wordsSeen = data?.stats?.wordsSeen ?? 47;
  const minutes = data?.stats?.minutes ?? 4;
  const check = `<div style="width:60px;height:60px;border-radius:50%;margin:0 auto 20px;background:linear-gradient(135deg,#fcd34d,#f4c430);background-color:#fcd34d;text-align:center;line-height:60px;box-shadow:0 14px 30px -10px rgba(252,211,77,0.6);"><span style="color:${DPE.goldInk};font-size:30px;font-weight:900;">&#10003;</span></div>`;
  const blocks = [
    block(`${check}${eyebrow("First story complete")}${head(`That's how<br/>it ${gold("works.")}`, 40)}${lead(
      "You just finished your first story. Those words you tapped are already starting to stick. Now keep the thread going."
    )}`, "44px 44px 0"),
    block(cols([statChip({ n: String(wordsSeen), label: "new words seen" }), statChip({ n: `${minutes} min`, label: "of reading" })], 12), "26px 44px 0"),
    block(cta("Read your next story", href), "26px 44px 0"),
  ];
  return {
    subject: "You finished your first story 🎉",
    html: shell({ preheader: "That's the whole method, in one read.", blocks, baseUrl: b, assetBase: ab }),
    text: [
      "First story complete.",
      "",
      "You just finished your first story. Those words you tapped are already starting to stick. Now keep the thread going.",
      "",
      `${wordsSeen} new words seen · ${minutes} min of reading.`,
      "",
      `Read your next story: ${href}`,
      "— Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 4 · HOW IT WORKS */
export function buildHowItWorksEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const href = `${b}/?explore=1`;
  const card = `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:18px;padding:22px 22px 24px;box-shadow:0 20px 44px -22px rgba(0,0,0,0.7);">
    <p style="margin:0;font-family:${DPE.font};font-weight:700;font-size:19px;line-height:1.5;color:${DPE.fg};text-align:center;">La ${hi("fonda")} de San &Aacute;ngel huele a mole.</p>
    <div style="max-width:300px;margin:18px auto 0;">${vocabCard(1)}</div>
    <div style="margin-top:16px;font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};text-align:center;">Tap once. Meaning, audio and a save button, without leaving the story.</div>
  </div>`;
  const blocks = [
    block(`${eyebrow("Why it works", DPE.sky)}${head(`Words stick when<br/>they live in a ${gold("story.")}`, 36)}${lead(
      "Lists make you memorize. Stories make you remember. See a word inside a scene, tap it once, and it lands where it belongs."
    )}`, "44px 44px 0"),
    block(card, "28px 44px 0", false),
    block(cta("Try it on a new story", href), "26px 44px 0"),
  ];
  return {
    subject: "Why reading beats memorizing",
    html: shell({ preheader: "Tap any word. We'll do the rest.", blocks, baseUrl: b, assetBase: ab }),
    text: [
      "Why it works.",
      "",
      "Lists make you memorize. Stories make you remember. See a word inside a scene, tap it once, and it lands where it belongs.",
      "Tap once. Meaning, audio and a save button, without leaving the story.",
      "",
      `Try it on a new story: ${href}`,
      "— Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 5 · WEEKLY RECAP */
export function buildRecapEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const href = `${b}/?welcome=1`;
  const storiesCount = data?.stats?.storiesCount ?? 3;
  const wordsCount = data?.stats?.wordsCount ?? 128;
  const daysActive = data?.stats?.daysActive ?? 5;
  const week = data?.stats?.weekDays ?? [true, true, false, true, true, true, false];
  const labels = "MTWTFSS";
  const dayCells = week.map((on, i) => {
    const barBg = on
      ? "linear-gradient(180deg,#fcd34d,#f4c430);background-color:#fcd34d;box-shadow:0 6px 14px -8px rgba(252,211,77,0.7);"
      : "rgba(125,211,252,0.10);";
    return `<td width="${Math.floor(100 / 7)}%" align="center" valign="top" style="vertical-align:top;padding:0 3px;">
      <div style="height:30px;border-radius:7px;background:${barBg}"></div>
      <div style="margin-top:7px;font-family:${DPE.font};font-weight:700;font-size:10.5px;color:${DPE.faint};">${labels[i]}</div>
    </td>`;
  }).join("");
  const weekPanel = `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:14px;padding:16px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:12px;"><tr>
      <td style="font-family:${DPE.font};font-weight:800;font-size:11.5px;letter-spacing:0.08em;text-transform:uppercase;color:${DPE.muted};">This week</td>
      <td align="right" style="text-align:right;font-family:${DPE.font};font-weight:800;font-size:12px;color:${DPE.gold};">${daysActive} of 7 days</td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;"><tr>${dayCells}</tr></table>
  </div>`;
  const tiles = cols([
    statTile({ n: String(storiesCount), label: "stories", tone: "gold" }),
    statTile({ n: String(wordsCount), label: "words", tone: "sky" }),
    statTile({ n: String(daysActive), label: "days active", tone: "green" }),
  ], 12);
  const blocks = [
    block(`${eyebrow("Your first week")}${head(`Look how far<br/>you've ${gold("come.")}`, 38)}${lead(
      "Seven days in. Here is the week you just put together, one story at a time."
    )}`, "44px 44px 0"),
    block(tiles, "28px 44px 0"),
    block(weekPanel, "18px 44px 0", false),
    block(cta("Keep your rhythm", href), "24px 44px 0"),
  ];
  return {
    subject: "Your first week, in numbers",
    html: shell({ preheader: "Look how far you've come.", blocks, baseUrl: b, assetBase: ab }),
    text: [
      "Your first week.",
      "",
      `${storiesCount} stories · ${wordsCount} words · ${daysActive} days active.`,
      "Seven days in. Here is the week you just put together, one story at a time.",
      "",
      `Keep your rhythm: ${href}`,
      "— Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 6 · NEXT / IDENTITY */
export function buildNextEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const href = `${b}/?explore=1`;
  const stories = data?.nextStories ?? [
    { title: "El metro de Madrid", level: "A2", minutes: 5, coverUrl: cover("ss-es-es", data) },
    { title: "Un mate en Palermo", level: "A2", minutes: 4, coverUrl: cover("ss-es-arg", data) },
    { title: "Kaffee in Kreuzberg", level: "A1", minutes: 6, coverUrl: cover("ss-de-de", data) },
  ];
  const cards = cols(stories.slice(0, 3).map((s) => storyCardV({
    cover: s.coverUrl, title: s.title, level: s.level, meta: s.minutes ? `· ${s.minutes} min` : undefined,
  })), 12);
  const blocks = [
    block(`${eyebrow("You're becoming a reader", DPE.sky)}${head(`A few stories down.<br/>${gold("Many to go.")}`, 37)}${lead(
      "You are reading in a new language now. Here are three more, picked for where you are."
    )}`, "44px 44px 0"),
    block(cards, "28px 40px 0"),
    block(cta("Choose your next story", href), "28px 44px 0"),
  ];
  return {
    subject: "You're becoming a reader in your new language",
    html: shell({ preheader: "Pick what you read next.", blocks, baseUrl: b, assetBase: ab }),
    text: [
      "You're becoming a reader.",
      "",
      "You are reading in a new language now. Here are three more, picked for where you are.",
      ...stories.slice(0, 3).map((s) => `• ${s.title}${s.level ? ` (${s.level})` : ""}`),
      "",
      `Choose your next story: ${href}`,
      "— Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 7a · WIN-BACK REMINDER */
export function buildWinReminderEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const href = `${b}/library`;
  const covers = data?.libraryCovers ?? [cover("ss-es-mx", data), cover("ss-es-es", data), cover("ss-de-de", data)];
  const lib = `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;"><tr>${covers
    .slice(0, 3)
    .map((c, i) => `${i > 0 ? '<td width="12" style="width:12px;font-size:0;">&nbsp;</td>' : ""}<td><img src="${c}" alt="" width="96" height="132" style="width:96px;height:132px;object-fit:cover;border-radius:12px;display:block;box-shadow:0 14px 28px -14px rgba(0,0,0,0.8);" /></td>`)
    .join("")}</tr></table>`;
  const blocks = [
    block(`${eyebrow("It's been a little while", DPE.sky)}${head(`Your stories are<br/>${gold("still here.")}`, 38)}${lead(
      "Your library, your saved words and your progress are waiting exactly where you left them."
    )}`, "46px 44px 0"),
    block(`<div style="opacity:0.85;">${lib}</div>`, "30px 44px 0"),
    block(cta("Open your library", href), "30px 44px 0"),
  ];
  return {
    subject: "Your stories are still here",
    html: shell({ preheader: "Your library and progress are waiting where you left them.", blocks, baseUrl: b, assetBase: ab, footerNote: "You haven't read in a while, so we're checking in." }),
    text: [
      "It's been a little while.",
      "",
      "Your library, your saved words and your progress are waiting exactly where you left them.",
      "",
      `Open your library: ${href}`,
      "— Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 7b · WIN-BACK VALUE */
export function buildWinValueEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const href = `${b}/?new=1`;
  const stories = data?.newStories ?? [
    { title: "Un mate en Palermo", level: "A2", minutes: 5, coverUrl: cover("ss-es-arg", data) },
    { title: "El metro de Madrid", level: "A2", minutes: 4, coverUrl: cover("ss-es-es", data) },
  ];
  const cards = cols(stories.slice(0, 2).map((s) => storyCardV({
    cover: s.coverUrl, title: s.title, level: s.level, meta: s.minutes ? `· ${s.minutes} min` : undefined, badgeText: "New",
  })), 12);
  const blocks = [
    block(`${eyebrow("New since you've been gone")}${head(`Fresh stories,<br/>your ${gold("language.")}`, 37)}${lead(
      "We have been busy. New short stories at your level, ready when you are."
    )}`, "46px 44px 0"),
    block(cards, "28px 44px 0"),
    block(cta("See what's new", href), "28px 44px 0"),
  ];
  return {
    subject: "New stories since you've been gone",
    html: shell({ preheader: "New short stories at your level, ready when you are.", blocks, baseUrl: b, assetBase: ab, footerNote: "A quick note about what's new since your last visit." }),
    text: [
      "New since you've been gone.",
      "",
      "We have been busy. New short stories at your level, ready when you are.",
      ...stories.slice(0, 2).map((s) => `• ${s.title}${s.level ? ` (${s.level})` : ""}`),
      "",
      `See what's new: ${href}`,
      "— Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 7c · WIN-BACK SUNSET */
export function buildWinSunsetEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const href = `${b}/account/emails`;
  const blocks = [
    block(`<div style="margin:0 auto 22px;">${logoImg(ab, 40)}</div>${eyebrow("One last note", DPE.muted)}${head(`We'll ${gold("stop here.")}`, 36)}${lead(
      "We don't want to crowd your inbox, so we'll pause these emails. Your stories and saved words stay saved, always. Come back whenever you like."
    )}`, "54px 44px 0"),
    block(`${cta("Keep me in", href)}<div style="margin-top:14px;font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};">Or do nothing, and we'll quietly step back.</div>`, "32px 44px 0"),
  ];
  return {
    subject: "We'll stop here, your stories stay saved",
    html: shell({ preheader: "We'll pause these emails. Your stories stay saved, always.", blocks, baseUrl: b, assetBase: ab, footerNote: "This is the last email in this series." }),
    text: [
      "One last note.",
      "",
      "We don't want to crowd your inbox, so we'll pause these emails. Your stories and saved words stay saved, always. Come back whenever you like.",
      "",
      `Keep me in: ${href}`,
      "Or do nothing, and we'll quietly step back.",
      "— Digital Polyglot",
    ].join("\n"),
  };
}

export type LifecycleKind =
  | "welcome"
  | "nudge"
  | "celebration"
  | "howItWorks"
  | "recap"
  | "next"
  | "winReminder"
  | "winValue"
  | "winSunset";

export const LIFECYCLE_BUILDERS: Record<LifecycleKind, (data?: LifecycleData) => BuiltEmail> = {
  welcome: buildWelcomeEmail,
  nudge: buildNudgeEmail,
  celebration: buildCelebrationEmail,
  howItWorks: buildHowItWorksEmail,
  recap: buildRecapEmail,
  next: buildNextEmail,
  winReminder: buildWinReminderEmail,
  winValue: buildWinValueEmail,
  winSunset: buildWinSunsetEmail,
};
