/**
 * Recastea el Traveler ES/Spain A2 (cmqc6tojm000032el2ebwsgkn) al patrón que
 * usan TODOS los journeys vivos: un narrador por historia, con voz aprobada.
 *
 * El draft venía repartido por personaje con 14 voces, ninguna en la allowlist,
 * así que `assertVoiceApproved` cortaba las 21. Ningún journey publicado hace
 * eso: España A0 es narrador único, LATAM Traveler rota narradores (uno por
 * historia) y México/Brasil Traveler ni siquiera traen dialogueSpec.
 *
 * Narrador por hilo temático, alternando las dos voces peninsulares aprobadas
 * PARA NARRACIÓN. Va por hilo y no por historia para que las tres historias de
 * un mismo arco (mismos personajes, misma trama) las lea la misma voz.
 *
 * `speaker` se conserva tal cual: el mixer lo usa para callar el ambiente en
 * los tramos de narrador (feedback_ambient_not_under_narrator). Solo cambia
 * `voice`. NO se genera audio aquí; esto solo reasigna datos.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { assertVoiceApproved } from "../src/lib/approvedVoices";

const prisma = new PrismaClient();
const JOURNEY = "cmqc6tojm000032el2ebwsgkn";
const apply = process.argv.includes("--apply");

const JAVIER = "eHAEFkimnYz57pupUMcq"; // Javier Rojas (ES peninsular, m); narración aprobada
const NURIA = "2EWay75ikIPKrY4w2j69";  // Nuria Storyteller & Calm (ES peninsular, f); narración aprobada
const MAIA = "jipeLrCHZ6ByxrU2JP9i";   // Maia (ES peninsular, f); PRÁCTICA aprobada

const NARRATOR_BY_TOPIC: Record<string, string> = {
  "community-celebrations": JAVIER,
  "food-everyday-life": NURIA,
  "home-family": JAVIER,
  "legends-folklore": NURIA,
  "meeting-new-people": JAVIER,
  "nature-adventure": NURIA,
  "places-getting-around": JAVIER,
};

const LABEL: Record<string, string> = { [JAVIER]: "Javier Rojas", [NURIA]: "Nuria", [MAIA]: "Maia" };

async function run() {
  // Cinturón: si alguna de las tres saliera de la allowlist, esto revienta
  // aquí y no deja el journey a medio recastear.
  for (const v of [JAVIER, NURIA, MAIA]) assertVoiceApproved(v, "recast:a2-spain");

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY },
    select: { id: true, slug: true, topic: true, dialogueSpec: true, audioUrl: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });

  let written = 0;
  for (const s of stories) {
    const narrator = NARRATOR_BY_TOPIC[s.topic];
    if (!narrator) throw new Error(`Sin narrador asignado para el tema ${s.topic}`);
    const spec = (s.dialogueSpec as { voice?: string; text: string; speaker?: string }[] | null) ?? [];
    const recast = spec.map((seg) => ({ ...seg, voice: narrator }));
    const before = new Set(spec.map((x) => x.voice)).size;
    const stale = s.audioUrl ? "  ← audio viejo, hecho con el reparto anterior" : "";
    console.log(
      `${s.slug.padEnd(28)} ${s.topic.padEnd(22)} ${String(spec.length).padStart(2)} segmentos  ${before} voces → 1 (${LABEL[narrator]})${stale}`,
    );
    if (apply) {
      await prisma.journeyStory.update({
        where: { id: s.id },
        data: { dialogueSpec: recast, voiceId: narrator, practiceVoiceId: MAIA },
      });
      written++;
    }
  }
  console.log(apply ? `\nrecasteadas ${written} historias (dialogueSpec + voiceId + practiceVoiceId)` : `\n(dry run; añade --apply para escribir)`);
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
