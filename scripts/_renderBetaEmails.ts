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
    askThem: "Open a story, skip forward twice, and tell us if the highlight keeps up.",
  },
  // Se escriben como ARREGLOS, no como la queja de quien lo dijo: el bloque
  // enseña lo que ya funciona, no la factura del reporte.
  fixedForThem: [
    "Story audio no longer starts a second late when you open a story.",
  ],
};

// Las tres formas del correo de la mejora de las glosas. La version personal
// se renderiza dos veces: citar a una persona sale bien por casualidad, y el
// fallo solo se ve con las dos al lado.
//
// El copy cuenta lo que hace la app ahora. Ni el expediente de quien escribio
// (cuantas veces toco una palabra, cuantas historias abrio), ni la mejora
// presentada como consecuencia de su mensaje.
// Las capturas viven en public/email/glosses y se sirven desde `assetBase`;
// en la previsualizacion se apunta al dev server para poder verlas ya.
const SHOT_BASE = "http://localhost:3000";

const GLOSS_CHANGES = [
  "Tap any word and the card shows the phrase it belongs to, translated the way it is used right there.",
  "Highlighted words got the same treatment, on top of the definition they already had.",
];

// El titular es el mismo para los tres: la mejora es una, y lo que resuelve
// no cambia segun quien la lea.
const HEADLINE = "A better way to learn as you read";

const TRY_IT = "Open a story and tap a few words while you read. If something is still unclear, tell us.";

const improvementGeneric: BetaEmailData = {
  ...common,
  assetBase: SHOT_BASE,
  improvement: {
    headline: HEADLINE,
    example: {
      word: "baja",
      sentence: "Lucía baja del tren en Madrid.",
      caption: "baja del tren: gets off the train, and the whole verb one tap away.",
      image: "/email/glosses/baja-tap.gif",
      fullSizeImage: "/email/glosses/baja-after.png",
    },
    changes: GLOSS_CHANGES,
    askThem: TRY_IT,
    ctaUrl: "https://digitalpolyglot.com/explore",
  },
};

const improvementColombe: BetaEmailData = {
  ...common,
  firstName: "Colombe",
  assetBase: SHOT_BASE,
  improvement: {
    headline: HEADLINE,
    quote:
      "What made me almost delete the app is the lack of opportunities to understand the grammar after clicking on the word. Also, the word wasn't really explained much, and I had to actively search for the meaning.",
    quotedAt: "In your final survey, 24 August.",
    highlights: [
      "Tap any word and the card shows the phrase it belongs to, translated the way it is used right there.",
      "It covers every story in your journey, not only the ones you have read.",
    ],
    example: {
      word: "baja",
      sentence: "Lucía baja del tren en Madrid.",
      caption: "baja del tren: gets off the train, and the whole verb one tap away.",
      image: "/email/glosses/baja-tap.gif",
      fullSizeImage: "/email/glosses/baja-after.png",
    },
    changes: ["Articles, numbers and character names are no longer tappable. The card had nothing to add about them."],
    askThem: TRY_IT,
    ctaUrl: "https://digitalpolyglot.com/explore",
  },
};

const improvementTy: BetaEmailData = {
  ...common,
  firstName: "Ty",
  assetBase: SHOT_BASE,
  improvement: {
    headline: HEADLINE,
    quote:
      "While highlighted words and phrases are well defined, other words sometimes did not reflect the actual context of the sentence. Often, the definition of a word changes depending on phrasing.",
    quotedAt: "In your review, 23 August.",
    highlights: [
      "Tap any word and the card shows the phrase it belongs to, translated the way it is used right there.",
      "The same word can say different things in different stories, which is how the language actually works.",
      "It covers every story in the journey, not only the ones you have read.",
    ],
    example: {
      word: "baja",
      sentence: "Lucía baja del tren en Madrid.",
      caption: "baja del tren: gets off the train, and the whole verb one tap away.",
      image: "/email/glosses/baja-tap.gif",
      fullSizeImage: "/email/glosses/baja-after.png",
    },
    changes: ["Highlighted words got the same treatment, on top of the definition they already had."],
    askThem: TRY_IT,
    ctaUrl: "https://digitalpolyglot.com/explore",
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
  { kind: "improvement", label: "11 · Mejora (todos los demás)", data: improvementGeneric },
  {
    kind: "improvement",
    label: "11b · Mejora (quien escribió)",
    data: improvementColombe,
    file: "improvement_colombe",
  },
  {
    kind: "improvement",
    label: "11c · Mejora (el otro que escribió)",
    data: improvementTy,
    file: "improvement_ty",
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
