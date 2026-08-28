/**
 * Manda el correo de la mejora de las glosas a los beta testers que SI han
 * leido: los que tienen al menos un evento de lectura (abrir historia, leerla
 * o terminar su audio). A quien escribio sobre las glosas se le manda la
 * version con su cita; al resto, la misma noticia sin cita.
 *
 *   npx tsx scripts/_sendImprovementToReaders.ts          # en seco, no manda
 *   npx tsx scripts/_sendImprovementToReaders.ts --send   # manda de verdad
 *
 * Va por `sendBetaEmail`, no por un fetch a Resend: ese camino respeta la baja
 * (`unsubscribedAll`), escribe el registro que impide mandar dos veces lo
 * mismo y pone el token del pie para poder darse de baja. Un script propio se
 * salta las tres cosas.
 */
import Module from "node:module";
import { config } from "dotenv";

// `betaProgram` arrastra prisma, que importa `server-only`, y ese modulo
// existe para reventar fuera de un componente de servidor. Mismo apaño que
// scripts/_inviteApplicantBeta.ts y _runBetaTriage.ts.
const load = (Module as unknown as { _load: (r: string, ...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, ...args: unknown[]) {
  if (request === "server-only") return {};
  return load.call(this, request, ...args);
};

config({ path: ".env.local" });
config({ path: ".env" });

const HEADLINE = "A better way to learn as you read";
const TRY_IT =
  "Open a story and tap a few words while you read. If something is still unclear, tell us.";
const EXAMPLE = {
  word: "baja",
  sentence: "Lucía baja del tren en Madrid.",
  caption: "baja del tren: gets off the train, and the whole verb one tap away.",
  image: "/email/glosses/baja-tap.gif",
};
const PARA_TODOS = [
  "Tap any word and the card shows the phrase it belongs to, translated the way it is used right there.",
  "Highlighted words got the same treatment, on top of the definition they already had.",
];

/**
 * Quien escribio sobre las glosas. Su correo lleva su cita, que es el
 * reconocimiento; el resto del cuerpo es el mismo para todos.
 */
const CITAS: Record<string, { quote: string; quotedAt: string; highlights: string[] }> = {
  "dovedivine2015@gmail.com": {
    quote:
      "What made me almost delete the app is the lack of opportunities to understand the grammar after clicking on the word. Also, the word wasn't really explained much, and I had to actively search for the meaning.",
    quotedAt: "In your final survey, 24 August.",
    highlights: [
      "Tap any word and the card shows the phrase it belongs to, translated the way it is used right there.",
      "It covers every story in your journey, not only the ones you have read.",
    ],
  },
  "ty@tystober.com": {
    quote:
      "While highlighted words and phrases are well defined, other words sometimes did not reflect the actual context of the sentence. Often, the definition of a word changes depending on phrasing.",
    quotedAt: "In your review, 23 August.",
    highlights: [
      "Tap any word and the card shows the phrase it belongs to, translated the way it is used right there.",
      "The same word can say different things in different stories, which is how the language actually works.",
    ],
  },
};

const LECTURA = ["story_opened", "journey_story_read", "audio_complete", "continue_listening_progress"];

async function main() {
  const enviar = process.argv.includes("--send");
  const { PrismaClient } = await import("../src/generated/prisma");
  const { sendBetaEmail } = await import("../src/lib/betaProgram");
  const prisma = new PrismaClient();

  const signups = await prisma.betaSignup.findMany({
    where: { status: { in: ["invited", "active", "accepted"] } },
    select: {
      id: true,
      email: true,
      firstName: true,
      clerkUserId: true,
      targetLanguage: true,
      platform: true,
    },
  });

  const ids = signups.map((s) => s.clerkUserId).filter((v): v is string => Boolean(v));
  const eventos = await prisma.userMetric.groupBy({
    by: ["userId"],
    where: { userId: { in: ids }, eventType: { in: LECTURA } },
    _count: { _all: true },
  });
  const leidos = new Map(eventos.map((e) => [e.userId, e._count._all]));
  const destinatarios = signups.filter((s) => s.clerkUserId && (leidos.get(s.clerkUserId) ?? 0) > 0);

  console.log(`${destinatarios.length} personas con lecturas (de ${signups.length} activas)\n`);

  for (const s of destinatarios) {
    const cita = s.email ? CITAS[s.email.toLowerCase()] : undefined;
    const data = {
      improvement: {
        headline: HEADLINE,
        example: EXAMPLE,
        askThem: TRY_IT,
        ...(cita
          ? { quote: cita.quote, quotedAt: cita.quotedAt, highlights: cita.highlights, changes: [] }
          : { changes: PARA_TODOS }),
      },
    };

    if (!enviar) {
      console.log(`  [en seco] ${(s.firstName ?? "(sin nombre)").padEnd(14)} ${s.email}  ${cita ? "con su cita" : "general"}`);
      continue;
    }

    const resultado = await sendBetaEmail({ kind: "improvement", signup: s, data });
    console.log(`  ${resultado.padEnd(9)} ${(s.firstName ?? "(sin nombre)").padEnd(14)} ${s.email}  ${cita ? "con su cita" : "general"}`);
  }

  if (!enviar) console.log("\nNada enviado. Con --send sale de verdad.");
  await prisma.$disconnect();
}

main();
