// Renders a plain personal note to one applicant. Preview by default.
//
//   npx tsx scripts/_personalNote.ts <email> <slug>            # preview only
//   npx tsx scripts/_personalNote.ts <email> <slug> --send     # actually sends
//
// The text lives in NOTES below rather than on the command line: these are
// written, reread and argued over before they go out, and a heredoc in shell
// history is a bad home for that.

import Module from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

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

const NOTES: Record<
  string,
  { subject: string; paragraphs: string[]; signOff?: string | string[] }
> = {
  // Four things the earlier drafts got wrong, kept here so they do not come
  // back:
  //   1. "Thank you for applying" with no object. She applied to an iPhone
  //      beta eleven days earlier and is now reading a first name she has
  //      never seen. Say who is writing and what she applied to.
  //   2. It claimed the TestFlight invite was in her inbox. It was not: Apple
  //      never sent it. Never assert the state of someone else's mailbox.
  //   3. It read as a reply to a message she had just sent.
  //   4. It said the two grandmothers "do not sound alike". The difference
  //      this product actually teaches is which WORDS people use; sound is the
  //      voice's job, not the copy's.
  //
  // The delay is described, not counted: a hardcoded number of days goes stale
  // the moment this text is reused for someone else.
  "variant-question": {
    subject: "One question before you start",
    paragraphs: [
      "I'm Alejandro, the founder of Digital Polyglot. You applied for our iPhone beta back in July, and I'm sorry it took me this long to answer: I read every application myself, and yours has stayed with me since.",
      "Yours is the reason I hoped people would write. You are not trying to pass a test. You want one particular woman to understand you in her own kitchen, and you want to be funny while you do it. That is exactly what we build for: the words people in one place actually use, not an average of a language nobody speaks.",
      "So, one thing before you start: where is she from? A Colombian grandmother and a Spanish one do not use the same words, and I would rather start you on hers.",
      "Just reply with her country and I will point you at the right stories.",
    ],
    signOff: ["Alejandro", "Founder, Digital Polyglot"],
  },
};

const email = process.argv[2];
const slug = process.argv[3];
const send = process.argv.includes("--send");

if (!email || !slug || !NOTES[slug]) {
  console.error(`usage: tsx scripts/_personalNote.ts <email> <slug> [--send]`);
  console.error(`slugs: ${Object.keys(NOTES).join(", ")}`);
  process.exit(1);
}

(async () => {
  const { PrismaClient } = await import("../src/generated/prisma");
  const { buildPersonalEmail } = await import("../src/lib/emails/personal");
  const prisma = new PrismaClient();

  const signup = await prisma.betaSignup.findFirst({ where: { email } });
  if (!signup) {
    console.log(`no applicant with email ${email}`);
    await prisma.$disconnect();
    return;
  }

  const note = NOTES[slug];
  const built = buildPersonalEmail({ firstName: signup.firstName, ...note });
  const out = `/tmp/claude-501/personal-${slug}.html`;
  writeFileSync(out, built.html);

  console.log(`to      : ${signup.email}`);
  console.log(`subject : ${built.subject}`);
  console.log(`preview : ${out}\n`);
  console.log(built.text);

  if (!send) {
    console.log("\n(preview only, nothing sent. add --send)");
    await prisma.$disconnect();
    return;
  }

  const { sendPersonalNote } = await import("../src/lib/betaProgram");
  const result = await sendPersonalNote({ signup, slug, ...note });
  console.log(`\nresult  : ${result}`);
  await prisma.$disconnect();
})();
