import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio, parseDialogueSegments } from "../src/lib/elevenlabs";

const PREFIXES = [
  "Un video, claro",
  "Oye, ¿y también",
  "Puede ser. Por eso",
  "Renata abre el refrigerador",
  "Pues no tenemos casi nada",
  "Ah, ahora sí soy tu amiga",
  "Entre los tres lo sacamos",
];

async function main() {
  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findFirst({
    where: { slug: "la-promesa-del-mole" },
    select: { text: true },
  });
  if (!story?.text) throw new Error("no story text");

  const segs = parseDialogueSegments(story.text);
  const chosen = PREFIXES.map((p) => {
    const s = segs.find((g) => g.text.startsWith(p));
    if (!s) throw new Error(`no segment for prefix: ${p}`);
    return s;
  });

  console.log(`segmentos elegidos: ${chosen.length} / ${PREFIXES.length}`);
  chosen.forEach((c) => console.log(`  [${c.speaker}] ${c.text.slice(0, 46)}...`));

  // Reconstruir un mini-texto preservando EXACTAMENTE el texto de cada
  // segmento, así la cache key coincide con el render completo posterior.
  const mini = chosen
    .map((c) => (c.speaker.toLowerCase() === "narrator" ? c.text : `${c.speaker}: ${c.text}`))
    .join("\n\n");

  console.log("→ generando sample SIN stitching (trim-v7-nostitch)...");
  const result = await generateAndUploadMultiVoiceAudio({
    storyText: mini,
    title: "",
    voiceMap: {
      narrator: "JW8DGEuLp9WxIS5IdxMM", // andreti
      "Sofía": "ewn5JTa3lNPY8QVuZJi6", // ana_sofia
      Renata: "m7yTemJqdIqrcNleANfX", // ana_maria
      Mateo: "p1Q3ihQuPjyyENa1RGtl", // tom
    },
    ambientPath: null,
    language: "spanish",
    disableStitching: true,
  });

  if (!result) throw new Error("generation returned null");
  console.log(`SAMPLE_URL::${result.url}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
