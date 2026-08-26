// Renders every beta email to HTML without sending anything.
//
// They were written in one sitting and are meant to be read weeks apart, which
// is exactly the case the project's own rule targets: any batch of three or
// more gets read consecutively before it counts as done, because repeated
// openings and repeated structures only show up side by side.
//
//   npx tsx scripts/_renderBetaEmails.ts
//   open /tmp/claude-501/beta-emails/index.html

import { mkdirSync, writeFileSync } from "node:fs";
import { BETA_EMAIL_BUILDERS, type BetaEmailKind, type BetaEmailData } from "../src/lib/emails/beta";

const OUT = "/tmp/claude-501/beta-emails";
mkdirSync(OUT, { recursive: true });

// Realistic data, not lorem: a thin sample makes every email look fine.
const common: BetaEmailData = {
  baseUrl: "https://digitalpolyglot.com",
  firstName: "Marta",
  targetLanguage: "Spanish",
  testflightUrl: "https://testflight.apple.com/join/example",
  feedbackUrl: "https://digitalpolyglot.com/beta/feedback?token=demo",
  reviewUrl: "https://apps.apple.com/app/id6760942737?action=write-review",
  playOptInUrl: "https://play.google.com/apps/testing/com.digitalpolyglot.app",
  playGroupJoinUrl: "https://groups.google.com/g/dpl-android-beta",
};

const release: BetaEmailData = {
  ...common,
  release: {
    version: "1.0",
    buildNumber: "280",
    headline: "Audio starts the moment you press play",
    whatsNew: [
      "Story audio no longer waits a beat before starting.",
      "Tapping a word while the audio plays does not pause it any more.",
      "The streak chips stop showing zeros before you have any progress.",
    ],
    knownIssues: ["Practice audio still cuts the last syllable on very short words."],
    askThem: "Open a story, skip forward twice, and tell me if the highlight keeps up.",
  },
  fixedForThem: [
    "The audio started about a second late every time I opened a story.",
  ],
};

// The three shapes of the "we heard you" send, with the real work behind the
// glosses. Two testers reported it in their final surveys, so the personal
// version is rendered twice: quoting one person is easy to get right by
// accident, and the failure mode only shows when two of them sit side by side.
const GLOSS_CHANGES = [
  "Tap any word and the card leads with the phrase it belongs to, translated the way it is used right there.",
  "Verbs show the conjugation with the person and the tense, nouns their gender and plural, adjectives their agreement.",
  "The card leads with the word exactly as the story spells it, with the infinitive beside it when the two differ.",
  "Highlighted words got the same treatment: the definition you already had, plus the phrase and the forms.",
  "Articles, numbers and character names are no longer tappable. The card had nothing to add about them.",
];

// Las capturas viven en public/email/glosses y se sirven desde `assetBase`;
// en la previsualizacion se apunta al dev server para poder verlas ya.
const SHOT_BASE = "http://localhost:3000";

const heardYouGeneric: BetaEmailData = {
  ...common,
  assetBase: SHOT_BASE,
  heardYou: {
    changes: GLOSS_CHANGES,
    example: {
      word: "baja",
      sentence: "Lucía baja del tren en Madrid.",
      before: "goes down, lowers",
      after: "baja del tren: gets off the train, with the whole present tense of bajar",
      beforeImage: "/email/glosses/baja-before.png",
      afterImage: "/email/glosses/baja-after.png",
    },
    askThem: "Open any story, tap a verb, and see whether the card tells you who is doing it and when.",
    ctaUrl: "https://digitalpolyglot.com/stories",
  },
};

const heardYouColombe: BetaEmailData = {
  ...common,
  firstName: "Colombe",
  assetBase: SHOT_BASE,
  heardYou: {
    headline: "A word now explains the sentence it is in",
    quote:
      "What made me almost delete the app is the lack of opportunities to understand the grammar after clicking on the word. Also, the word wasn't really explained much, and I had to actively search for the meaning.",
    quotedAt: "In your final survey, 24 August.",
    becauseOfYou: [
      "Every word of the two stories you read now carries the phrase it sits in, translated, plus its forms.",
      "The 122 verb forms in the other 20 stories of your journey show their conjugation when you tap them.",
      "You tapped baja, helado and paraguas three times each. All three said something about the word instead of about the sentence. They do not any more.",
    ],
    example: {
      word: "baja",
      sentence: "Lucía baja del tren en Madrid. (Marta enseña el Retiro)",
      before: "goes down, lowers",
      after: "baja del tren: gets off the train, with the whole present tense of bajar",
      beforeImage: "/email/glosses/baja-before.png",
      afterImage: "/email/glosses/baja-after.png",
    },
    changes: GLOSS_CHANGES.slice(2),
    askThem: "Reopen Marta enseña el Retiro and tap baja. If the card still does not explain the grammar, tell me.",
    ctaUrl: "https://digitalpolyglot.com/stories",
  },
};

const heardYouTy: BetaEmailData = {
  ...common,
  firstName: "Ty",
  assetBase: SHOT_BASE,
  heardYou: {
    headline: "Same word, different story, different meaning",
    quote:
      "While highlighted words and phrases are well defined, other words sometimes did not reflect the actual context of the sentence. Often, the definition of a word changes depending on phrasing.",
    quotedAt: "In your review, 23 August.",
    becauseOfYou: [
      "You were right about the cause: one flat list of 1,739 words served all 21 stories, so a word could only ever have one meaning.",
      "The 95 words you tapped in your three stories now carry the phrase they belong to, and the same word says different things in different stories.",
      "Tapping the same word five times in a row is the signature of a card that is not answering. Those were the ones fixed first.",
    ],
    example: {
      word: "punto",
      sentence: "Pagabas y punto. (Le toca a Mateo)",
      before: "point, dot",
      after: "pagabas y punto: you paid, and that was that, with the other two uses underneath",
      beforeImage: "/email/glosses/punto-before.png",
      afterImage: "/email/glosses/punto-after.png",
    },
    changes: GLOSS_CHANGES.slice(2),
    askThem: "Reopen Le toca a Mateo and tap punto, tocaba and quedar. Those three were yours.",
    ctaUrl: "https://digitalpolyglot.com/stories",
  },
};

const ORDER: Array<{ kind: BetaEmailKind; label: string; data: BetaEmailData }> = [
  { kind: "accepted", label: "1 · Accepted, you're in", data: common },
  { kind: "accepted_android", label: "1b · Accepted, Android", data: { ...common, platform: "android" } },
  { kind: "waitlist", label: "2 · Waitlist", data: common },
  { kind: "declined", label: "3 · Declined", data: common },
  { kind: "install_nudge", label: "4 · Never installed (day 3)", data: common },
  {
    kind: "install_nudge",
    label: "4b · Never installed, Android",
    data: { ...common, platform: "android" },
    file: "install_nudge_android",
  },
  { kind: "feedback_ask", label: "5 · One-question ask (day 7)", data: common },
  { kind: "mid_survey", label: "6 · Halfway survey (day 21)", data: common },
  { kind: "release_note", label: "7 · Build note", data: release },
  {
    kind: "release_note",
    label: "7b · Build note, Android",
    data: { ...release, platform: "android" },
    file: "release_note_android",
  },
  { kind: "final_survey", label: "8 · Final survey", data: common },
  { kind: "review_ask", label: "9 · Review ask (happy)", data: common },
  { kind: "review_recover", label: "10 · Recovery (unhappy)", data: common },
  { kind: "heard_you", label: "11 · You told us (everyone else)", data: heardYouGeneric },
  {
    kind: "heard_you",
    label: "11b · You told us (the tester who reported it)",
    data: heardYouColombe,
    file: "heard_you_colombe",
  },
  {
    kind: "heard_you",
    label: "11c · You told us (the other reporter)",
    data: heardYouTy,
    file: "heard_you_ty",
  },
];

const cards: string[] = [];
const plain: string[] = [];

for (const entry of ORDER) {
  const { kind, label, data } = entry;
  // One kind can render twice, once per platform, so the filename cannot just
  // be the kind or the Android variant would overwrite the iOS one.
  const slug = (entry as { file?: string }).file ?? kind;
  const { subject, html, text } = BETA_EMAIL_BUILDERS[kind](data);
  writeFileSync(`${OUT}/${slug}.html`, html);

  cards.push(`<section class="card">
    <header>
      <div class="label">${label}</div>
      <div class="subject">${subject.replace(/</g, "&lt;")}</div>
      <a href="./${slug}.html" target="_blank">open alone</a>
    </header>
    <iframe src="./${slug}.html" loading="lazy"></iframe>
  </section>`);

  plain.push(`──────── ${label}\nSUBJECT: ${subject}\n\n${text}\n`);
}

writeFileSync(
  `${OUT}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Beta emails, in order</title>
<style>
  body { margin:0; background:#0b1220; color:#e7eefc; font:15px/1.5 -apple-system,system-ui,sans-serif; }
  h1 { font-size:22px; margin:28px 24px 6px; }
  .hint { margin:0 24px 24px; color:#8aa0be; max-width:760px; }
  .card { margin:0 24px 34px; }
  header { display:flex; align-items:baseline; gap:14px; margin-bottom:8px; flex-wrap:wrap; }
  .label { font-weight:700; color:#fcd34d; }
  .subject { color:#c2d2e8; }
  a { color:#7dd3fc; font-size:13px; }
  iframe { width:100%; max-width:620px; height:900px; border:1px solid #1e3358; border-radius:12px; background:#051834; }
</style>
<h1>The beta emails, in the order a tester receives them</h1>
<p class="hint">Read them straight through, the way one person would over six weeks. What matters is not
whether each is good on its own but whether they sound like ten different moments or like one template
wearing ten hats: repeated openings, the same sentence rhythm, the same closing move.</p>
${cards.join("\n")}`,
);

writeFileSync(`${OUT}/all.txt`, plain.join("\n"));

console.log(`Rendered ${ORDER.length} emails to ${OUT}`);
console.log(`  open ${OUT}/index.html`);
