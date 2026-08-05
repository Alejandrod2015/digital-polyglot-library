// A plain personal note to someone who is NOT in the beta database yet.
// Preview by default, exactly like _personalNote.
//
//   npx tsx scripts/_coldNote.ts <slug>           # preview every recipient
//   npx tsx scripts/_coldNote.ts <slug> --send    # actually sends
//
// Why this exists separately from _personalNote: that one resolves the person
// through BetaSignup, which is correct for an applicant and useless for someone
// who has not applied. Oskar and Christoph said yes in a private message; the
// whole point of the note is to get them to the form in the first place, so
// there is no row to look up.
//
// No BetaEmailLog entry is written, because that table is keyed by signupId and
// these people have none. The Resend id is printed instead, so "did it arrive?"
// is still answerable without trawling the whole account.

import Module from "node:module";
import { existsSync, readFileSync } from "node:fs";

const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return load.call(this, request, ...args);
};

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

type Note = {
  subject: string;
  recipients: Array<{ firstName: string; email: string }>;
  paragraphs: (firstName: string) => string[];
  signOff?: string | string[];
};

const NOTES: Record<string, Note> = {
  // What earlier drafts of this one got wrong, kept so they do not come back:
  //   1. The subject named neither the app nor the product. In an inbox you see
  //      the subject and the sender, and nothing else.
  //   2. "Thanks for saying yes to trying it." Trying what? Say what the app is.
  //   3. A whole paragraph pitching a product they had ALREADY agreed to try,
  //      with the thanks buried inside it. They said yes. Thank them and move.
  //   4. "Apple ID" and "TestFlight" are Apple's vocabulary, not a normal
  //      person's. Name the address by where they can find it.
  //   5. A colon doing rhetorical work in the subject AND in the body. Once.
  //
  // The warning about the automatic note is not a detail. Submitting the form
  // triggers a waitlist email within seconds, because auto-invite is off and
  // the engine queues everyone. Being told "you're in" by a friend and then
  // "you're on the list" by a robot reads as a brush-off.
  "beta-invite": {
    subject: "One form and you're in the Digital Polyglot beta",
    recipients: [
      { firstName: "Oskar", email: "oskar@luckner-net.de" },
      { firstName: "Christoph", email: "Christoph.koehner@googlemail.com" },
    ],
    paragraphs: () => [
      "Thank you for offering to test the iPhone app. It means a lot to have someone try it before it launches.",
      "One form first, so I know which language and level to set you up with:",
      "https://www.digitalpolyglot.com/beta",
      "One field is worth a second of care. It asks for the email your iPhone's App Store uses. That is where Apple sends your invitation to install, and it is often not the address you write to me from.",
      "You will get an automatic \"you're on the list\" note right away. Ignore it. Your actual invitation comes from me.",
      "Two minutes, and then it's on me.",
    ],
    signOff: "Alejandro",
  },
};

const slug = process.argv[2];
const send = process.argv.includes("--send");

if (!slug || !NOTES[slug]) {
  console.error("usage: tsx scripts/_coldNote.ts <slug> [--send]");
  console.error(`slugs: ${Object.keys(NOTES).join(", ")}`);
  process.exit(1);
}

(async () => {
  const { buildPersonalEmail } = await import("../src/lib/emails/personal");
  const note = NOTES[slug];

  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.PERSONAL_EMAIL_FROM || "Alejandro from Digital Polyglot <support@digitalpolyglot.com>";
  const replyTo = "support@digitalpolyglot.com";

  for (const r of note.recipients) {
    const { html, text } = buildPersonalEmail({
      firstName: r.firstName,
      subject: note.subject,
      paragraphs: note.paragraphs(r.firstName),
      signOff: note.signOff,
    });

    console.log("─".repeat(66));
    console.log(`to      : ${r.email}`);
    console.log(`subject : ${note.subject}`);
    console.log("");
    console.log(text);

    if (!send) continue;

    if (!apiKey) {
      console.error("RESEND_API_KEY not set, nothing sent");
      process.exit(1);
    }
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const sent = await resend.emails.send({
      from,
      to: r.email,
      subject: note.subject,
      html,
      text,
      replyTo,
      tags: [
        { name: "type", value: "personal" },
        { name: "category", value: `cold-${slug}` },
      ],
    });
    if (sent.error) {
      console.error(`FAILED for ${r.email}:`, sent.error);
      process.exit(1);
    }
    console.log(`SENT. resendId=${sent.data?.id ?? "(none returned)"}`);
  }

  if (!send) console.log("\n(preview only, nothing sent. add --send)");
})();
