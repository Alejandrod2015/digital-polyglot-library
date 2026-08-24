/** Reparte las voces del Traveler ES latam A1: un narrador por PAIS (nunca por
 *  historia suelta) y Jhenny de practica en las 21, igual que el A0 latam.
 *
 *  Peru NO lleva a Giancarlos, que es quien narra el A0: al usuario no le
 *  convence y el 2026-08-24 aprobo a Terry en su lugar.
 *
 *  Ritmo: Terry lee a 3,33 pal/s y el usuario la aprobo SECA, sin bajarla a las
 *  2,45 del A1 hermano de Espana. Aqui no se toca el audio, solo se anota quien
 *  narra; el pacing se decide al renderizar. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { assertVoiceApproved } from "../src/lib/approvedVoices";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
const PRACTICA = "FXGrCtY3PEyfqczBAlqm"; // Jhenny, la de todo latam
const POR_TEMA: Record<string, { pais: string; voz: string }> = {
  "night-buses":           { pais: "Peru",      voz: "ulJB4yAMefhHYn0FWgGy" }, // Terry
  "prices-and-change":     { pais: "Mexico",    voz: "JW8DGEuLp9WxIS5IdxMM" }, // Andreti
  "help-and-repairs":      { pais: "Mexico",    voz: "JW8DGEuLp9WxIS5IdxMM" },
  "calls-and-messages":    { pais: "Colombia",  voz: "yHD4CsKkghm19ToGLJEC" }, // Hernando
  "doors-and-neighbours":  { pais: "Colombia",  voz: "yHD4CsKkghm19ToGLJEC" },
  "names-for-things":      { pais: "Argentina", voz: "MjtZn5tagxL1RO6w9ER5" }, // Lionel
  "plans-and-invitations": { pais: "Argentina", voz: "MjtZn5tagxL1RO6w9ER5" },
};
(async () => {
  const seco = process.argv.includes("--dry");
  for (const { voz } of Object.values(POR_TEMA)) assertVoiceApproved(voz, "a1latam-voces");
  assertVoiceApproved(PRACTICA, "a1latam-practica");
  const j = await p.journey.findUnique({ where: { id: A1 }, select: { topics: true } });
  const filas = await p.journeyStory.findMany({ where: { journeyId: A1 },
    select: { id: true, title: true, topic: true, slotIndex: true, voiceId: true } });
  filas.sort((a, b) => (j!.topics.indexOf(a.topic) - j!.topics.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  let n = 0;
  for (const [i, f] of filas.entries()) {
    const cfg = POR_TEMA[f.topic];
    if (!cfg) { console.error(`tema sin voz: ${f.topic}`); process.exit(1); }
    console.log(`${String(i + 1).padStart(2)} ${cfg.pais.padEnd(10)} ${f.title}`);
    if (seco) continue;
    await p.journeyStory.update({ where: { id: f.id },
      data: { voiceId: cfg.voz, practiceVoiceId: PRACTICA } });
    n++;
  }
  console.log(seco ? "\n--dry: nada escrito." : `\n${n} historias con narrador y voz de practica.`);
  await p.$disconnect();
})();
