/**
 * Manda los tres correos de la mejora a UNA direccion de prueba, para verlos
 * en una bandeja de verdad (que es el unico sitio donde se sabe si el GIF se
 * anima y como se ve el telefono).
 *
 *   npx tsx scripts/_sendImprovementPreview.ts delcarpio321@gmail.com
 *
 * Las imagenes van ADJUNTAS y referenciadas con `cid:`, no por URL: en
 * `public/email/glosses` estan, pero hasta que eso se despliegue
 * reader.digitalpolyglot.com devuelve 404 y el correo llegaria con el hueco.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { BETA_EMAIL_BUILDERS, type BetaEmailData } from "../src/lib/emails/beta";

config({ path: ".env.local" });
config({ path: ".env" });

const to = process.argv[2];
if (!to) throw new Error("Falta la direccion: npx tsx scripts/_sendImprovementPreview.ts <email>");

const ASSETS = "https://reader.digitalpolyglot.com";
const GIF = "public/email/glosses/baja-tap.gif";
const PNG = "public/email/glosses/baja-after.png";

const HEADLINE = "A better way to learn as you read";
const TRY_IT =
  "Open a story and tap a few words while you read. If something is still unclear, tell us.";
const CHANGES = [
  "Tap any word and the card shows the phrase it belongs to, translated the way it is used right there.",
  "Highlighted words got the same treatment, on top of the definition they already had.",
];
const EXAMPLE = {
  word: "baja",
  sentence: "Lucía baja del tren en Madrid.",
  caption: "baja del tren: gets off the train, and the whole verb one tap away.",
  image: "/email/glosses/baja-tap.gif",
  fullSizeImage: "/email/glosses/baja-after.png",
};

const common: BetaEmailData = {
  baseUrl: "https://digitalpolyglot.com",
  assetBase: ASSETS,
  targetLanguage: "Spanish",
};

const CASES: Array<{ label: string; data: BetaEmailData }> = [
  {
    label: "todos los demas",
    data: {
      ...common,
      firstName: "Marta",
      improvement: { headline: HEADLINE, changes: CHANGES, example: EXAMPLE, askThem: TRY_IT },
    },
  },
  {
    label: "Colombe",
    data: {
      ...common,
      firstName: "Colombe",
      improvement: {
        headline: HEADLINE,
        quote:
          "What made me almost delete the app is the lack of opportunities to understand the grammar after clicking on the word. Also, the word wasn't really explained much, and I had to actively search for the meaning.",
        quotedAt: "In your final survey, 24 August.",
        highlights: [
          "Tap any word and the card shows the phrase it belongs to, translated the way it is used right there.",
          "It covers every story in your journey, not only the ones you have read.",
        ],
        example: EXAMPLE,
        askThem: TRY_IT,
      },
    },
  },
  {
    label: "Ty",
    data: {
      ...common,
      firstName: "Ty",
      improvement: {
        headline: HEADLINE,
        quote:
          "While highlighted words and phrases are well defined, other words sometimes did not reflect the actual context of the sentence. Often, the definition of a word changes depending on phrasing.",
        quotedAt: "In your review, 23 August.",
        highlights: [
          "Tap any word and the card shows the phrase it belongs to, translated the way it is used right there.",
          "The same word can say different things in different stories, which is how the language actually works.",
        ],
        example: EXAMPLE,
        changes: [
          "Highlighted words got the same treatment, on top of the definition they already had.",
        ],
        askThem: TRY_IT,
      },
    },
  },
];

/** Cambia las URLs de los assets por referencias `cid:` a los adjuntos. */
function withInlineAssets(html: string): string {
  return html
    .replaceAll(`${ASSETS}/email/glosses/baja-tap.gif`, "cid:baja-tap")
    .replaceAll(`${ASSETS}/email/glosses/baja-after.png`, "cid:baja-after");
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Faltan RESEND_API_KEY o EMAIL_FROM.");

  const attachments = [
    { filename: "baja-tap.gif", content: readFileSync(GIF).toString("base64"), content_id: "baja-tap" },
    { filename: "baja-after.png", content: readFileSync(PNG).toString("base64"), content_id: "baja-after" },
  ];

  for (const c of CASES) {
    const { subject, html, text } = BETA_EMAIL_BUILDERS.improvement(c.data);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: `[preview ${c.label}] ${subject}`,
        html: withInlineAssets(html),
        text,
        attachments,
      }),
    });
    const body = await res.json().catch(() => ({}));
    console.log(res.ok ? `enviado (${c.label}): ${JSON.stringify(body)}` : `FALLO (${c.label}): ${res.status} ${JSON.stringify(body)}`);
  }
}

main();
