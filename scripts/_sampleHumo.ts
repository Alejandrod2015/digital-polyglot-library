import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio, parseDialogueSegments } from "../src/lib/elevenlabs";

// Líneas elegidas para testear: título (H), "huele/humo" (H muda), y las 4 voces.
const PREFIXES = [
  "El video dice fuego bajo", // Renata
  "Oigan, huele raro",        // Mateo (huele + oler)
  "No, para nada",            // Sofía (huele)
  "Sofía levanta la tapa",    // narrator (humo)
];

async function main() {
  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findFirst({
    where: { slug: "humo-en-la-cocina" },
    select: { text: true, title: true },
  });
  if (!story?.text) throw new Error("no story text");

  const segs = parseDialogueSegments(story.text);
  const chosen = PREFIXES.map((p) => {
    const s = segs.find((g) => g.text.startsWith(p));
    if (!s) throw new Error(`no segment for prefix: ${p}`);
    return s;
  });

  console.log(`título: ${JSON.stringify(story.title)}`);
  console.log(`segmentos: ${chosen.length}/${PREFIXES.length}`);
  chosen.forEach((c) => console.log(`  [${c.speaker}] ${c.text.slice(0, 50)}`));

  const mini = chosen
    .map((c) => (c.speaker.toLowerCase() === "narrator" ? c.text : `${c.speaker}: ${c.text}`))
    .join("\n\n");

  console.log("→ generando sample (título narrado + 4 líneas, disableStitching)...");
  const result = await generateAndUploadMultiVoiceAudio({
    storyText: mini,
    title: story.title ?? "Humo en la cocina", // se narra primero → testea la H del título
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
