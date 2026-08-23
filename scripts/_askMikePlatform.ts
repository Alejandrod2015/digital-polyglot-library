// Una pregunta a UNA persona: Mike, que dijo que no tiene iPhone cuando la
// beta era solo iPhone, recibió un "no encajas" y lleva desde entonces en la
// cola sin saberlo. El ledger lo hace idempotente por slug.
//   --dry  imprime y no envía
import Module from "node:module";
const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (r: string, ...a: unknown[]) {
  if (r === "server-only") return {};
  return load.call(this, r, ...a);
};
import { config } from "dotenv";
config({ path: "/Users/alejandrodelcarpio/digital-polyglot-library/.env.local", quiet: true });

const DRY = process.argv.includes("--dry");
const SLUG = "platform-question";
const SUBJECT = "Which phone do you use?";
const PARAGRAPHS = [
  "I owe you a correction. Back in August I wrote to say your application was not a fit for the beta. That was my mistake.",
  "You told us you do not have an iPhone, and at the time the beta only ran on TestFlight, so the form never asked you anything else. It asks now, because there is an Android build too.",
  "So the only thing I need from you is which phone you actually use, iPhone or Android. One word is a complete answer and I will take it from there.",
  "Sorry for the long silence.",
];

(async () => {
  const { PrismaClient } = await import("../src/generated/prisma");
  const p = new PrismaClient();
  const mike = await p.betaSignup.findFirst({
    where: { email: "mikeswainjr@gmail.com" },
    select: { id: true, email: true, firstName: true },
  });
  if (!mike) throw new Error("no encontrado");

  console.log(`Para: ${mike.firstName} <${mike.email}>`);
  console.log(`Asunto: ${SUBJECT}\n`);
  console.log(`Hi ${mike.firstName},\n`);
  console.log(PARAGRAPHS.join("\n\n"));
  console.log("\nAlejandro\n");

  const ya = await p.betaEmailLog.findUnique({
    where: { signupId_kind_releaseId: { signupId: mike.id, kind: "personal", releaseId: SLUG } },
  });
  console.log(ya ? "YA ENVIADO antes, el ledger lo bloquearía." : "No enviado todavía.");

  if (DRY) { console.log("\n(--dry: no se envía nada)"); await p.$disconnect(); return; }

  const { sendPersonalNote } = await import("../src/lib/betaProgram");
  const r = await sendPersonalNote({ signup: mike, slug: SLUG, subject: SUBJECT, paragraphs: PARAGRAPHS });
  console.log(`\nresultado: ${r}`);
  await p.$disconnect();
})();
