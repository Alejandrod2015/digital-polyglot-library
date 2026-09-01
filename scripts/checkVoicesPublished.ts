/**
 * LINT: toda voz que YA suena en produccion tiene que estar en la allowlist.
 *
 * WHY: `approvedVoices.ts` se sembro el 2026-07-19 con las voces publicadas
 * ESE dia y nadie la reconcilio despues. El Traveler LATAM A1 se publico mas
 * tarde y su narrador peruano (Terry) quedo fuera, asi que `assertVoiceApproved`
 * habria tirado al narrar el A2 con la misma voz que ya suena en el A1. El gate
 * no distingue "lista vieja" de "voz que el usuario nunca aprobo", y no debe:
 * lo que hay que arreglar es que la lista se quede vieja sin que se note.
 *
 * Una voz que narra una historia PUBLICADA es una voz que el usuario acepto en
 * produccion. Si no esta en la lista, o falta la entrada o la historia no
 * deberia estar publicada; las dos merecen ruido.
 *
 * OJO: solo Claude tiene prohibido editar la allowlist (pre-voice-approval-guard).
 * Este lint AVISA con el id y donde suena; anadirlo sigue siendo decision del
 * usuario, con su frase de aprobacion.
 *
 * Es un TRINQUETE: los huecos que ya existian al escribirlo viven en
 * scripts/voices-published-known-gaps.json y no bloquean, porque anadirlos
 * exige la frase del usuario y no puedo hacerlo yo. Lo que bloquea es un hueco
 * NUEVO, que es el que aparece sin que nadie lo mire.
 *
 * Run:  npm run lint:voices-published
 * Exit: 0 si no hay huecos nuevos, 1 si aparece uno.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { APPROVED_VOICES } from "../src/lib/approvedVoices";

const prisma = new PrismaClient();

/** Huecos ya conocidos: no bloquean, pero siguen saliendo por pantalla. */
const CONOCIDOS: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(__dirname, "voices-published-known-gaps.json"), "utf8")
);

(async () => {
  const journeys = await prisma.journey.findMany({
    where: { status: "active" },
    select: { id: true, language: true, variant: true, levels: true },
  });
  const donde = new Map(
    journeys.map((j) => [j.id, `${j.language}/${j.variant}/${(j.levels ?? []).join(",")}`])
  );

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: { in: journeys.map((j) => j.id) }, NOT: { audioUrl: null } },
    select: { voiceId: true, practiceVoiceId: true, journeyId: true, slug: true },
  });

  const huecos = new Map<string, Set<string>>();
  for (const s of stories) {
    for (const v of [s.voiceId, s.practiceVoiceId]) {
      if (!v || APPROVED_VOICES[v]) continue;
      if (!huecos.has(v)) huecos.set(v, new Set());
      huecos.get(v)!.add(donde.get(s.journeyId) ?? s.journeyId);
    }
  }

  const nuevos = [...huecos].filter(([id]) => !CONOCIDOS[id]);
  const viejos = [...huecos].filter(([id]) => CONOCIDOS[id]);
  for (const [id] of viejos) console.log(`voices-published: hueco conocido, no bloquea: ${id} (${CONOCIDOS[id]})`);

  if (nuevos.length === 0) {
    console.log(
      `voices-published: limpio (${stories.length} historias publicadas con audio, todas con voz en la lista)`
    );
    return;
  }

  console.error(
    `voices-published: ${nuevos.length} voz/voces NUEVAS suenan en produccion y no estan en src/lib/approvedVoices.ts\n`
  );
  for (const [id, sitios] of nuevos) console.error(`  ${id}  ·  ${[...sitios].join(", ")}`);
  console.error(
    "\nUna voz que narra una historia publicada ya se acepto en produccion, pero\n" +
      "la allowlist no lo sabe, asi que el proximo render con ella TIRARA.\n" +
      "Claude no puede anadirla: hace falta la frase de aprobacion del usuario\n" +
      "(\"apruebo la voz\"). Si la voz NO deberia sonar ahi, el problema es la\n" +
      "historia publicada, no la lista."
  );
  process.exitCode = 1;
})().finally(() => prisma.$disconnect());
