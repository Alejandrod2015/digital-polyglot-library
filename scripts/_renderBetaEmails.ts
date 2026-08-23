// Renders all ten beta emails to HTML without sending anything.
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
  // Con la forma real (base64url del correo, punto, firma). La vista previa se
  // usa para juzgar el pie, y sin token pintaba el respaldo, que no es lo que
  // recibe nadie desde que TODAS las clases llevan uno.
  unsubscribeToken: "bWFydGFAZXhhbXBsZS5jb20.ZGVtby1zaWduYXR1cmU",
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

// `file` estaba en uso desde siempre y sin declarar: `scripts/` no entra en el
// `include` del tsconfig, así que nadie se quejaba.
const ORDER: Array<{
  kind: BetaEmailKind;
  label: string;
  data: BetaEmailData;
  file?: string;
}> = [
  { kind: "accepted", label: "1 · Accepted, you're in", data: common },
  { kind: "accepted_android", label: "1b · Accepted, Android", data: { ...common, platform: "android" } },
  { kind: "waitlist", label: "2 · Waitlist", data: common },
  { kind: "waitlist_closed", label: "2b · Waitlist closed, never got in", data: common },
  { kind: "declined", label: "3 · Declined", data: common },
  { kind: "install_nudge", label: "4 · Never installed (day 3)", data: common },
  {
    kind: "install_nudge",
    label: "4b · Never installed, Android",
    data: { ...common, platform: "android" },
    file: "install_nudge_android",
  },
  { kind: "feedback_ask", label: "5 · One-question ask (day 7)", data: common },
  // Sin día en la etiqueta: el umbral es `midSurveyAfterDays`, se cambia desde
  // el Studio, y decía 21 con la config viva en 14.
  { kind: "mid_survey", label: "6 · Mid-beta survey", data: common },
  { kind: "release_note", label: "7 · Build note", data: release },
  {
    kind: "release_note",
    label: "7b · Build note, Android",
    data: { ...release, platform: "android" },
    file: "release_note_android",
  },
  // Los tres nombran la TIENDA PÚBLICA, y hasta el 2026-08-24 dos de ellos la
  // fijaban a mano en "the App Store". No se veía aquí porque la vista previa
  // sólo tenía variante Android de los dos correos de instalación, que son los
  // únicos donde ya se sabía que la plataforma importaba.
  { kind: "final_survey", label: "8 · Final survey", data: common },
  {
    kind: "final_survey",
    label: "8b · Final survey, Android",
    data: { ...common, platform: "android" },
    file: "final_survey_android",
  },
  { kind: "review_ask", label: "9 · Review ask (happy)", data: common },
  {
    kind: "review_ask",
    label: "9b · Review ask, Android",
    data: {
      ...common,
      platform: "android",
      reviewUrl: "https://play.google.com/store/apps/details?id=com.digitalpolyglot.app",
    },
    file: "review_ask_android",
  },
  { kind: "review_recover", label: "10 · Recovery (unhappy)", data: common },
  {
    kind: "review_recover",
    label: "10b · Recovery, Android",
    data: { ...common, platform: "android" },
    file: "review_recover_android",
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
  `<!doctype html><meta charset="utf-8"><title>Beta emails, all ten in order</title>
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
<h1>The ten beta emails, in the order a tester receives them</h1>
<p class="hint">Read them straight through, the way one person would over six weeks. What matters is not
whether each is good on its own but whether they sound like ten different moments or like one template
wearing ten hats: repeated openings, the same sentence rhythm, the same closing move.</p>
${cards.join("\n")}`,
);

writeFileSync(`${OUT}/all.txt`, plain.join("\n"));

console.log(`Rendered ${ORDER.length} emails to ${OUT}`);
console.log(`  open ${OUT}/index.html`);
