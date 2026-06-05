// Digital Polyglot lifecycle email compositions (the 9 sends).
// Rewritten based on psychology + copy research from Duolingo, LingQ, et al.
// Principles: direct language, identity messaging, concrete metrics, one CTA,
// low-commitment actions, warm + self-aware tone.

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
  hi,
  badge,
  statTile,
  statChip,
  storyCardH,
  storyCardV,
  storyPreview,
  vocabCard,
  vocabGlossary,
  vocabChips,
  progressBar,
  audioBar,
  phoneFrame,
  cols,
  ctaSecondary,
} from "./kit";

export type StoryRef = {
  id?: string;
  title: string;
  level?: string;
  minutes?: number;
  coverUrl: string;
};

export type VocabItem = { word: string; definition: string };

export type LifecycleData = {
  baseUrl?: string;
  assetBase?: string;
  /** Signed token for unsubscribe / manage-preferences footer links. */
  unsubscribeToken?: string;
  firstStory?: {
    id?: string;
    title: string;
    level?: string;
    minutes?: number;
    coverUrl: string;
    teaser?: string;
    synopsis?: string;
    vocab?: VocabItem[];
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
    weekWords?: string[];
  };
  nextStories?: StoryRef[];
  newStories?: StoryRef[];
  newJourney?: {
    name: string;
    level: string;
    storyCount: number;
    firstStory: { id?: string; title: string; coverUrl: string; teaser?: string };
  };
  libraryCovers?: string[];
};

export type BuiltEmail = { subject: string; html: string; text: string };

function base(data?: LifecycleData): string {
  return data?.baseUrl ?? process.env.APP_BASE_URL ?? "https://digitalpolyglot.com";
}

function assetBase(data?: LifecycleData): string {
  return data?.assetBase ?? EMAIL_ASSET_BASE;
}

function cover(slug: string, data?: LifecycleData): string {
  return `${assetBase(data)}/covers/${slug}.jpg`;
}

/** Real story covers (R2) used as mock defaults so a no-arg render looks real.
 * These are individual-story covers, NOT book covers. In production, callers
 * pass the user's actual story data. */
const SAMPLE_STORIES = {
  mole: {
    id: "mole-en-san-angel",
    title: "Jueves con doña Luz",
    level: "A1",
    minutes: 4,
    coverUrl:
      "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/covers/journey-stories/mole-en-san-angel-1778228912112.png",
    teaser: "Es jueves al mediodía. La fonda de San Ángel huele a mole.",
    synopsis:
      "Marisol entra cansada a una fonda del sur de la ciudad y pide el mole del día. La cocinera, que la conoce hace años, se acerca con una receta antigua que quiere compartir antes de cerrar.",
    vocab: [
      { word: "fonda", definition: "Small, home-style Mexican eatery" },
      { word: "mole", definition: "Thick sauce of chiles and chocolate" },
      { word: "olla", definition: "Deep pot for stews and beans" },
    ] as VocabItem[],
    // Real sentences from the story; target words get highlighted via hi().
    contextSentences: [
      `La ${hi("fonda")} de San Ángel está abierta y huele a ${hi("mole")}.`,
      `En la cocina, doña Luz mueve una ${hi("olla")} grande.`,
    ],
    contextWords: ["fonda", "mole", "olla"],
  },
  canela: {
    id: "una-pizca-de-canela",
    title: "Una pizca de canela",
    level: "A1",
    minutes: 5,
    coverUrl:
      "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/images/una-pizca-de-canela-flux-1780307426951.png",
  },
  domingo: {
    id: "domingo-con-papa",
    title: "Domingo con papá",
    level: "A1",
    minutes: 4,
    coverUrl:
      "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/images/domingo-con-papa-flux-1780310207042.png",
  },
  trompo: {
    id: "carnitas-en-coyoacan",
    title: "Mientras gira el trompo",
    level: "A1",
    minutes: 5,
    coverUrl:
      "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/images/carnitas-en-coyoacan-flux-1778161473472.png",
  },
} as const;

/* ============================================================ 1 · WELCOME */
export function buildWelcomeEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const s = data?.firstStory ?? SAMPLE_STORIES.mole;
  const href = s.id ? `${b}/stories/${s.id}` : `${b}/stories/${SAMPLE_STORIES.mole.id}`;

  // Hero = the real reader moment: an authentic sentence where ONE word was just
  // tapped (its card opened), the others still highlighted and waiting. Shows
  // the product, doesn't dump every meaning, leaves curiosity. No GIF.
  const tapped = (w: string) =>
    `<span style="background:${DPE.gold};color:${DPE.goldInk};border-radius:5px;padding:1px 6px;font-weight:900;box-shadow:0 0 0 2px rgba(252,211,77,0.35);">${esc(
      w
    )}</span>`;

  const heroCard = `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:18px;padding:22px;text-align:left;box-shadow:0 20px 44px -22px rgba(0,0,0,0.7);">
    <div style="font-family:${DPE.font};font-weight:800;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${DPE.faint};margin-bottom:6px;">Your first story</div>
    <div style="font-family:${DPE.font};font-weight:900;font-size:17px;color:${DPE.fg};letter-spacing:-0.015em;margin-bottom:14px;">${esc(s.title)}</div>
    <p style="margin:0 0 9px;font-family:${DPE.font};font-weight:700;font-size:17px;line-height:1.7;color:${DPE.fg};">La ${tapped(
    "fonda"
  )} de San Ángel está abierta y huele a ${hi("mole")}.</p>
    <p style="margin:0;font-family:${DPE.font};font-weight:700;font-size:17px;line-height:1.7;color:${DPE.fg};">En la cocina, doña Luz mueve una ${hi(
    "olla"
  )} grande.</p>
    <div style="margin-top:16px;background:${DPE.card};border:1px solid rgba(125,211,252,0.30);border-radius:14px;padding:16px;">
      <div style="font-family:${DPE.font};font-weight:700;font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;color:${DPE.faint};margin-bottom:8px;">You tapped</div>
      <div style="font-family:${DPE.font};font-weight:900;font-size:21px;color:${DPE.gold};">fonda</div>
      <div style="margin-top:5px;font-family:${DPE.font};font-weight:600;font-size:15px;color:${DPE.fgSoft};line-height:1.4;">Small, home-style Mexican eatery</div>
      <div style="margin-top:12px;">${audioBar(0.92, true)}</div>
    </div>
    <div style="margin-top:13px;font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};">Two more words glowing in just that sentence. The rest are one tap away.</div>
  </div>`;

  const blocks = [
    block(
      `${eyebrow("Welcome to Digital Polyglot")}${head(`The ${gold("real")} language,<br/>from word one.`, 40)}${lead(
        "We picked a short story at your level. Tap any word to see what it means and hear it spoken. It's the everyday language locals actually use, learned in context, not the stuff from a textbook."
      )}`,
      "40px 44px 0"
    ),
    block(heroCard, "28px 44px 0", false),
    block(
      `${cta("Start your first story", href)}<div style="margin-top:13px;font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};">4 minutes · pick up anytime</div>`,
      "24px 44px 0"
    ),
  ];

  return {
    subject: "The language locals actually speak",
    html: shell({
      preheader: "Real, everyday language, learned in context.",
      blocks,
      baseUrl: b,
      assetBase: ab,
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      "Welcome to Digital Polyglot.",
      "",
      "We picked a short story at your level. Tap any word to see what it means and hear it spoken. It's the everyday language locals actually use, not textbook stuff.",
      "",
      `Start your first story: ${href}`,
      "4 minutes.",
      "",
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 2 · NUDGE */
export function buildNudgeEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const s = data?.firstStory ?? {
    ...SAMPLE_STORIES.mole,
    percentRead: 38,
    minutesLeft: 2,
  };
  const href = s.id ? `${b}/stories/${s.id}` : `${b}/stories/${SAMPLE_STORIES.mole.id}`;
  const pct = s.percentRead ?? 38;

  const blocks = [
    block(
      `${head(`The story you started<br/>is still ${gold("there.")}`, 40)}`,
      "40px 44px 0"
    ),
    block(
      `<img src="${s.coverUrl}" alt="${esc(s.title)}" width="220" height="220" style="width:220px;max-width:65%;height:auto;border-radius:14px;display:block;margin:0 auto;box-shadow:0 12px 28px -10px rgba(0,0,0,0.7);" />`,
      "26px 44px 0",
      true
    ),
    block(
      storyPreview({
        title: s.title,
        level: s.level,
        meta: `· ${s.minutes ?? 4} min · audio`,
        teaser: s.teaser,
        pct,
        pctLabel: `${pct}% read · ${s.minutesLeft ?? 2} min left`,
      }),
      "20px 44px 0",
      false
    ),
    block(cta("Pick it up where you left off", href), "26px 44px 0"),
  ];

  return {
    subject: `Just ${s.minutesLeft ?? 2} minutes from the ending`,
    html: shell({
      preheader: `${pct}% read, one last push.`,
      blocks,
      baseUrl: b,
      assetBase: ab,
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      "Your story is waiting.",
      "",
      `${pct}% read. About ${s.minutesLeft ?? 2} minutes left.`,
      "",
      `Pick it up now: ${href}`,
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 3 · CELEBRATION */
export function buildCelebrationEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const s = data?.firstStory ?? SAMPLE_STORIES.mole;
  const nextStory = data?.nextStories?.[0] ?? SAMPLE_STORIES.canela;
  const href = nextStory.id ? `${b}/stories/${nextStory.id}` : `${b}/stories/${SAMPLE_STORIES.canela.id}`;
  // Practice the words from the story they just finished.
  const storySlug = (s as { id?: string }).id ?? SAMPLE_STORIES.mole.id;
  const practiceHref = `${b}/practice?source=story&storySlug=${encodeURIComponent(storySlug)}&storyTitle=${encodeURIComponent(s.title)}`;
  const wordsSeen = data?.stats?.wordsSeen ?? 47;
  const vocab = (s as { vocab?: VocabItem[] }).vocab ?? [];
  // Word→meaning pairs in English: clear proof of what the learner picked up.
  const glossary = vocab.slice(0, 3).map((v) => ({ word: v.word, meaning: v.definition }));

  // Cover + title for recognition (no synopsis: the user just read it, and a
  // Spanish blurb is unreadable for an English-native A1).
  const storyContext = `<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:16px;">
    <tr>
      <td width="116" valign="middle" style="padding:16px 0 16px 16px;">
        <img src="${s.coverUrl}" alt="${esc(s.title)}" width="96" height="96" style="width:96px;height:96px;object-fit:cover;border-radius:12px;display:block;box-shadow:0 10px 22px -10px rgba(0,0,0,0.7);" />
      </td>
      <td valign="middle" style="padding:16px;text-align:left;">
        ${s.level ? badge(s.level) : ""}
        <div style="font-family:${DPE.font};font-weight:900;font-size:18px;color:${DPE.fg};letter-spacing:-0.015em;margin-top:8px;">${esc(s.title)}</div>
      </td>
    </tr>
  </table>`;

  // Words learned: clean word→meaning glossary (proof of learning, all in English)
  const moreCount = Math.max(0, wordsSeen - glossary.length);
  const vocabBlock = glossary.length
    ? `<div style="font-family:${DPE.font};font-weight:800;font-size:11.5px;letter-spacing:0.1em;text-transform:uppercase;color:${DPE.muted};margin-bottom:12px;text-align:left;">Real, everyday words you picked up</div>
       ${vocabGlossary({ glossary, more: moreCount })}`
    : "";

  const blocks = [
    block(`${head(`You finished. That ${gold("matters.")}`, 38)}`, "40px 44px 0"),
    block(storyContext, "26px 44px 0", false),
    block(
      `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td width="260" style="width:260px;">${statTile(
        { n: String(wordsSeen), label: "new words learned", tone: "gold" }
      )}</td></tr></table>`,
      "20px 44px 0"
    ),
    block(vocabBlock, "26px 44px 0", false),
    block(
      `${ctaSecondary("Practice these words →", practiceHref)}<div style="margin-top:11px;font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};">A 2-minute drill makes them stick.</div>`,
      "20px 44px 0"
    ),
    block(
      `<div style="font-family:${DPE.font};font-weight:800;font-size:11.5px;letter-spacing:0.1em;text-transform:uppercase;color:${DPE.muted};margin-bottom:14px;">Keep the momentum</div>
       <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:16px;">
         <tr>
           <td width="100" valign="top" style="padding:14px 0 14px 14px;">
             <img src="${nextStory.coverUrl}" alt="${esc(nextStory.title)}" width="84" height="84" style="width:84px;height:84px;object-fit:cover;border-radius:11px;display:block;box-shadow:0 10px 22px -10px rgba(0,0,0,0.7);" />
           </td>
           <td valign="middle" style="padding:14px;text-align:left;">
             <div style="font-family:${DPE.font};font-weight:700;font-size:11px;color:${DPE.sky};margin-bottom:4px;">UP NEXT</div>
             <div style="font-family:${DPE.font};font-weight:900;font-size:16px;color:${DPE.fg};">${esc(nextStory.title)}</div>
             <div style="font-family:${DPE.font};font-weight:600;font-size:12px;color:${DPE.muted};margin-top:4px;">${nextStory.level} · ${nextStory.minutes} min</div>
           </td>
         </tr>
       </table>`,
      "28px 44px 0",
      false
    ),
    block(cta("Start the next story", href), "24px 44px 0"),
  ];

  return {
    subject: `${wordsSeen} words you didn't know yesterday`,
    html: shell({
      preheader: "Real words that stuck, and what's next.",
      blocks,
      baseUrl: b,
      assetBase: ab,
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      "You finished.",
      "",
      `${s.title}: ${wordsSeen} new words learned.`,
      glossary.length
        ? `\nWords you picked up:\n${glossary.map((g) => `  ${g.word}: ${g.meaning}`).join("\n")}`
        : "",
      `\nPractice these words: ${practiceHref}`,
      "",
      `Up next: ${nextStory.title}`,
      `Start it: ${href}`,
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 5 · WEEKLY RECAP */
export function buildRecapEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const nextStory = data?.nextStories?.[0] ?? SAMPLE_STORIES.canela;
  const href = nextStory.id ? `${b}/stories/${nextStory.id}` : `${b}/stories/${SAMPLE_STORIES.canela.id}`;
  const storiesCount = data?.stats?.storiesCount ?? 3;
  const wordsCount = data?.stats?.wordsCount ?? 128;
  const daysActive = data?.stats?.daysActive ?? 5;
  const week = data?.stats?.weekDays ?? [true, true, false, true, true, true, false];
  const labels = "MTWTFSS";
  // A sample of real words from the week's stories: gives the "words learned"
  // number a tangible face (volume, not teaching).
  const weekWords = data?.stats?.weekWords ?? [
    "fonda", "mole", "olla", "cansada", "receta", "guajolote",
    "despacio", "cocina", "antigua", "sonríe", "compartir", "jueves",
  ];

  const dayCells = week
    .map((on, i) => {
      const barBg = on
        ? "linear-gradient(180deg,#fcd34d,#f4c430);background-color:#fcd34d;box-shadow:0 6px 14px -8px rgba(252,211,77,0.7);"
        : "rgba(125,211,252,0.10);";
      return `<td width="${Math.floor(100 / 7)}%" align="center" valign="top" style="vertical-align:top;padding:0 3px;">
      <div style="height:30px;border-radius:7px;background:${barBg}"></div>
      <div style="margin-top:7px;font-family:${DPE.font};font-weight:700;font-size:10.5px;color:${DPE.faint};">${labels[i]}</div>
    </td>`;
    })
    .join("");

  const weekPanel = `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:14px;padding:16px 18px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:12px;"><tr>
      <td style="font-family:${DPE.font};font-weight:800;font-size:11.5px;letter-spacing:0.08em;text-transform:uppercase;color:${DPE.muted};">This week</td>
      <td align="right" style="text-align:right;font-family:${DPE.font};font-weight:800;font-size:12px;color:${DPE.gold};">${daysActive} of 7 days active</td>
    </tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;"><tr>${dayCells}</tr></table>
  </div>`;

  const tiles = cols(
    [
      statTile({ n: String(storiesCount), label: "stories finished", tone: "gold" }),
      statTile({ n: String(wordsCount), label: "words learned", tone: "sky" }),
      statTile({ n: String(daysActive), label: "days active", tone: "green" }),
    ],
    12
  );

  const moreWords = Math.max(0, wordsCount - weekWords.length);
  const wordsPanel = `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:14px;padding:18px 18px 12px;">
    <div style="font-family:${DPE.font};font-weight:800;font-size:11.5px;letter-spacing:0.08em;text-transform:uppercase;color:${DPE.muted};margin-bottom:14px;text-align:left;">Real words you can use now</div>
    ${vocabChips(weekWords)}
    ${moreWords > 0 ? `<div style="margin-top:4px;font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};text-align:left;">+${moreWords} more in your library.</div>` : ""}
  </div>`;

  const blocks = [
    block(`${head(`${gold("One week.")}<br/>Look what you built.`, 40)}`, "40px 44px 0"),
    block(tiles, "28px 44px 0"),
    block(weekPanel, "18px 44px 0", false),
    block(wordsPanel, "14px 44px 0", false),
    block(
      `${cta("Continue building", href)}<div style="margin-top:14px;font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};">Momentum is everything.</div>`,
      "24px 44px 0"
    ),
  ];

  return {
    subject: `${wordsCount} words richer in a week`,
    html: shell({
      preheader: "A week of real language, in one look.",
      blocks,
      baseUrl: b,
      assetBase: ab,
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      "You built this in one week.",
      "",
      `${storiesCount} stories finished.`,
      `${wordsCount} words learned.`,
      `${daysActive} of 7 days active.`,
      "",
      `Continue: ${href}`,
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 6 · NEXT / IDENTITY */
export function buildNextEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const nextStory = data?.nextStories?.[0] ?? SAMPLE_STORIES.domingo;
  const href = nextStory.id ? `${b}/stories/${nextStory.id}` : `${b}/stories/${SAMPLE_STORIES.domingo.id}`;
  // Cumulative totals (the proof that an identity shifted, not a weekly count).
  const storiesCount = data?.stats?.storiesCount ?? 6;
  const wordsCount = data?.stats?.wordsCount ?? 240;

  // The threshold line: a before/after that names the identity change.
  const thresholdCard = `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:16px;padding:22px 24px;text-align:left;box-shadow:0 18px 40px -22px rgba(0,0,0,0.7);">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;">
      <tr>
        <td width="50%" valign="top" style="width:50%;vertical-align:top;padding-right:12px;">
          <div style="font-family:${DPE.font};font-weight:800;font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:${DPE.faint};margin-bottom:6px;">Two weeks ago</div>
          <div style="font-family:${DPE.font};font-weight:700;font-size:14px;line-height:1.5;color:${DPE.muted};">A wall of words you didn't know.</div>
        </td>
        <td width="50%" valign="top" style="width:50%;vertical-align:top;padding-left:12px;border-left:1px solid ${DPE.hair};">
          <div style="font-family:${DPE.font};font-weight:800;font-size:10.5px;letter-spacing:0.1em;text-transform:uppercase;color:${DPE.sky};margin-bottom:6px;">Today</div>
          <div style="font-family:${DPE.font};font-weight:700;font-size:14px;line-height:1.5;color:${DPE.fg};">${storiesCount} stories finished. ${wordsCount} words you actually use.</div>
        </td>
      </tr>
    </table>
  </div>`;

  const upNext = `<div style="font-family:${DPE.font};font-weight:800;font-size:11.5px;letter-spacing:0.1em;text-transform:uppercase;color:${DPE.muted};margin-bottom:14px;">Keep going</div>
     <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:16px;">
       <tr>
         <td width="100" valign="top" style="padding:14px 0 14px 14px;">
           <img src="${nextStory.coverUrl}" alt="${esc(nextStory.title)}" width="84" height="84" style="width:84px;height:84px;object-fit:cover;border-radius:11px;display:block;box-shadow:0 10px 22px -10px rgba(0,0,0,0.7);" />
         </td>
         <td valign="middle" style="padding:14px;text-align:left;">
           <div style="font-family:${DPE.font};font-weight:700;font-size:11px;color:${DPE.sky};margin-bottom:4px;">UP NEXT</div>
           <div style="font-family:${DPE.font};font-weight:900;font-size:16px;color:${DPE.fg};">${esc(nextStory.title)}</div>
           <div style="font-family:${DPE.font};font-weight:600;font-size:12px;color:${DPE.muted};margin-top:4px;">${nextStory.level} · ${nextStory.minutes} min</div>
         </td>
       </tr>
     </table>`;

  const blocks = [
    block(`${head(`You understand the<br/>${gold("real thing now.")}`, 40)}`, "40px 44px 0"),
    block(
      `<p style="margin:0 auto;max-width:430px;font-family:${DPE.font};font-weight:600;font-size:17px;line-height:1.6;color:${DPE.fgSoft};text-align:center;">Not textbook phrases. The everyday language locals actually speak, the one that was foreign to you two weeks ago. You get it today.</p>`,
      "16px 44px 0"
    ),
    block(thresholdCard, "28px 44px 0", false),
    block(upNext, "26px 44px 0", false),
    block(cta("Keep going", href), "26px 44px 0"),
  ];

  return {
    subject: "Notice how much more you understand?",
    html: shell({
      preheader: `${storiesCount} stories in. This is who you are now.`,
      blocks,
      baseUrl: b,
      assetBase: ab,
      unsubscribeToken: data?.unsubscribeToken,
    }),
    text: [
      "You understand the real thing now.",
      "",
      "Not textbook phrases. The everyday language locals actually speak, the one that was foreign to you two weeks ago. You get it today.",
      "",
      `Two weeks ago: a wall of unfamiliar words.`,
      `Today: ${storiesCount} stories finished, ${wordsCount} words you actually use.`,
      "",
      `Up next: ${nextStory.title}`,
      `Keep going: ${href}`,
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 7a · WIN-BACK REMINDER */
export function buildWinReminderEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  const s = data?.firstStory ?? { ...SAMPLE_STORIES.mole, percentRead: 38, minutesLeft: 2 };
  const href = s.id ? `${b}/stories/${s.id}` : `${b}/stories/${SAMPLE_STORIES.mole.id}`;
  const pct = s.percentRead ?? 38;
  const vocab = (s as { vocab?: VocabItem[] }).vocab ?? [];
  const glossary = vocab.slice(0, 3).map((v) => ({ word: v.word, meaning: v.definition }));
  const savedWords = data?.stats?.wordsSeen ?? 47;

  // The half-read story itself (real cover), with progress: the unfinished tension.
  const storyCard = `<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:16px;">
    <tr>
      <td width="116" valign="middle" style="padding:16px 0 16px 16px;">
        <img src="${s.coverUrl}" alt="${esc(s.title)}" width="96" height="96" style="width:96px;height:96px;object-fit:cover;border-radius:12px;display:block;box-shadow:0 10px 22px -10px rgba(0,0,0,0.7);" />
      </td>
      <td valign="middle" style="padding:16px;text-align:left;">
        ${s.level ? badge(s.level) : ""}
        <div style="font-family:${DPE.font};font-weight:900;font-size:17px;color:${DPE.fg};letter-spacing:-0.015em;margin:8px 0 10px;">${esc(s.title)}</div>
        ${progressBar(pct)}
        <div style="margin-top:7px;font-family:${DPE.font};font-weight:800;font-size:11.5px;color:${DPE.gold};">${pct}% read · ${s.minutesLeft ?? 2} min left</div>
      </td>
    </tr>
  </table>`;

  const wordsBlock = glossary.length
    ? `<div style="font-family:${DPE.font};font-weight:800;font-size:11.5px;letter-spacing:0.1em;text-transform:uppercase;color:${DPE.muted};margin-bottom:12px;text-align:left;">The ${savedWords} real words you learned are still saved</div>
       ${vocabGlossary({ glossary, more: Math.max(0, savedWords - glossary.length) })}`
    : "";

  const blocks = [
    block(`${head(`You stopped ${gold("halfway.")}`, 42)}`, "40px 44px 0"),
    block(
      `<p style="margin:0 auto;max-width:420px;font-family:${DPE.font};font-weight:600;font-size:16px;line-height:1.6;color:${DPE.fgSoft};text-align:center;">It's been a while, but nothing is lost. Your story is right where you left it.</p>`,
      "14px 44px 0"
    ),
    block(storyCard, "26px 44px 0", false),
    block(wordsBlock, "26px 44px 0", false),
    block(cta("Finish your story", href), "26px 44px 0"),
  ];

  return {
    subject: "Your half-finished story is still open",
    html: shell({
      preheader: `${pct}% read, and your ${savedWords} words are still saved.`,
      blocks,
      baseUrl: b,
      assetBase: ab,
      unsubscribeToken: data?.unsubscribeToken,
      footerNote: "We noticed you've been quiet. No pressure, just a reminder.",
    }),
    text: [
      "You stopped halfway.",
      "",
      `It's been a while, but nothing is lost. "${s.title}" is ${pct}% read, with ${s.minutesLeft ?? 2} minutes left.`,
      `The ${savedWords} words you learned are still saved.`,
      "",
      `Finish your story: ${href}`,
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 7b · WIN-BACK · THE "WHY" */
export function buildWinValueEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  // Objective: the reminder (6a) didn't reactivate them, so the block is
  // motivational, not practical. Reconnect with WHY they started, and prove with
  // a real sentence that they already read the language for real. No new content
  // pitch, no invented loss. Resumes THEIR own path (low commitment).
  const s = data?.firstStory ?? SAMPLE_STORIES.mole;
  const href = s.id ? `${b}/stories/${s.id}` : `${b}/stories/${SAMPLE_STORIES.mole.id}`;
  // A real line from a story they read: tangible proof they already read it.
  const provenSentence =
    (s as { teaser?: string }).teaser ?? "Es jueves al mediodía. La fonda de San Ángel huele a mole.";

  // Proof card: a sentence that was noise a month ago, that they read now.
  const proofCard = `<div style="background:${DPE.screen};border:1px solid ${DPE.cardLine};border-radius:16px;padding:22px 22px 20px;box-shadow:0 18px 40px -22px rgba(0,0,0,0.7);">
    <div style="font-family:${DPE.font};font-weight:800;font-size:11px;color:${DPE.faint};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;text-align:left;">A month ago, this was just noise</div>
    <p style="margin:0;font-family:${DPE.font};font-weight:700;font-size:19px;line-height:1.6;color:${DPE.fg};text-align:left;">${esc(
    provenSentence
  )}</p>
    <div style="margin-top:14px;font-family:${DPE.font};font-weight:700;font-size:13.5px;color:${DPE.sky};text-align:left;">You understand that now. That was the whole point.</div>
  </div>`;

  const blocks = [
    block(`${head(`Remember ${gold("why")} you started?`, 40)}`, "40px 44px 0"),
    block(
      `<p style="margin:0 auto;max-width:430px;font-family:${DPE.font};font-weight:600;font-size:16px;line-height:1.6;color:${DPE.fgSoft};text-align:center;">You didn't come here for points or streaks. You wanted to understand a language the way locals actually speak it. You were closer than it ever felt.</p>`,
      "14px 44px 0"
    ),
    block(proofCard, "26px 44px 0", false),
    block(
      `${cta("Pick up where you left off", href)}<div style="margin-top:13px;font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};">Same story. Right where you stopped.</div>`,
      "26px 44px 0"
    ),
  ];

  return {
    subject: "Remember why you started?",
    html: shell({
      preheader: "You came here for more than points.",
      blocks,
      baseUrl: b,
      assetBase: ab,
      unsubscribeToken: data?.unsubscribeToken,
      footerNote: "You've been away a while. This one's worth a minute.",
    }),
    text: [
      "Remember why you started?",
      "",
      "You didn't come here for points or streaks. You wanted to understand a language the way locals actually speak it. You were closer than it ever felt.",
      "",
      `A month ago this was just noise. You understand it now:`,
      `"${provenSentence}"`,
      "",
      `Pick up where you left off: ${href}`,
      "Digital Polyglot",
    ].join("\n"),
  };
}

/* ============================================================ 7c · WIN-BACK SUNSET */
export function buildWinSunsetEmail(data?: LifecycleData): BuiltEmail {
  const b = base(data);
  const ab = assetBase(data);
  // The CTA is the last real chance to come back to the language, NOT to manage
  // a subscription. Doing nothing = we quietly stop (list hygiene). No body logo
  // (the footer already has one).
  const href = `${b}/my-library`;

  const blocks = [
    block(
      `${eyebrow("Last check-in", DPE.muted)}${head(`We'll go ${gold("quiet")} now.`, 38)}`,
      "54px 44px 0"
    ),
    block(
      `<p style="margin:0 auto;max-width:430px;font-family:${DPE.font};font-weight:600;font-size:16px;line-height:1.6;color:${DPE.fgSoft};text-align:center;">This is the last email we'll send for now. But your stories, your saved words and your progress stay exactly where you left them. The door doesn't close.</p>`,
      "18px 44px 0"
    ),
    block(
      `${cta("Come back to your stories", href)}<div style="margin-top:14px;font-family:${DPE.font};font-weight:700;font-size:12.5px;color:${DPE.muted};">Or do nothing, and we'll quietly stop here.</div>`,
      "32px 44px 0"
    ),
  ];

  return {
    subject: "Before we go quiet",
    html: shell({
      preheader: "Your stories stay saved. Come back anytime.",
      blocks,
      baseUrl: b,
      assetBase: ab,
      unsubscribeToken: data?.unsubscribeToken,
      footerNote: "This is the last email for now.",
    }),
    text: [
      "We'll go quiet from here.",
      "",
      "This is the last email we'll send for now. But your stories, saved words and progress stay exactly where you left them. The door doesn't close.",
      "",
      `Come back to your stories: ${href}`,
      "Or ignore this. We'll be here when you're ready.",
      "Digital Polyglot",
    ].join("\n"),
  };
}

export type LifecycleKind =
  | "welcome"
  | "nudge"
  | "celebration"
  | "recap"
  | "next"
  | "winReminder"
  | "winValue"
  | "winSunset";

export const LIFECYCLE_BUILDERS: Record<
  LifecycleKind,
  (data?: LifecycleData) => BuiltEmail
> = {
  welcome: buildWelcomeEmail,
  nudge: buildNudgeEmail,
  celebration: buildCelebrationEmail,
  recap: buildRecapEmail,
  next: buildNextEmail,
  winReminder: buildWinReminderEmail,
  winValue: buildWinValueEmail,
  winSunset: buildWinSunsetEmail,
};
