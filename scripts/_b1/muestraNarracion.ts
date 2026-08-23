/**
 * MUESTRA de narracion del B1 Traveler ES/spain: titulo + primer parrafo de la
 * primera historia. NO es un render completo (guard 6d) y NO escribe en la fila
 * de la historia: solo sintetiza esos dos fragmentos por el pipeline canonico
 * `generateAndUploadMultiVoiceAudio`, para que la toma aprobada de oido sea la
 * MISMA que luego reutilice el render completo (cache por contenido).
 *
 * Uso: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_b1/muestraNarracion.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../../src/lib/elevenlabs";

const JOURNEY = "cmt5x67ze000l320cpgunu5vi";
const SLUG = "ya-no-queda-nadie";
// Maia: la MISMA voz que narra las 21 del A1 Traveler ES/spain que este journey
// continua. Esta en la allowlist (user-approved 2026-07-28).
const VOZ = "jipeLrCHZ6ByxrU2JP9i";

(async () => {
  const p = new PrismaClient();
  const s = await p.journeyStory.findFirst({
    where: { journeyId: JOURNEY, slug: SLUG },
    select: { title: true, text: true },
  });
  await p.$disconnect();
  if (!s) throw new Error(`no encuentro ${SLUG}`);

  const parrafo1 = s.text.split(/\n\s*\n/)[0].trim();
  console.log(`titulo: ${s.title}`);
  console.log(`parrafo: ${parrafo1}\n`);

  const out = await generateAndUploadMultiVoiceAudio({
    storyText: parrafo1,
    title: s.title,
    voiceMap: { narrator: VOZ },
    language: "spanish",
    disableStitching: true,
    antiUptalkGate: true,
  });
  if (!out) throw new Error("el pipeline devolvio null");

  console.log("\nURL:", out.url);
  console.log("fragmentos:", JSON.stringify(out.audioSegments, null, 1));
  console.log("qa:", JSON.stringify(out.audioQa, null, 1));
})();
