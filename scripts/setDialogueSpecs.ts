/**
 * Asigna dialogueSpec a todas las historias del Spanish-LATAM journey activo
 * que no lo tienen o que usan voces incorrectas (angela/kokoro/piper).
 *
 * NO genera audio. Solo escribe el spec en DB + actualiza voiceId = andreti.
 *
 * Usage:
 *   tsx scripts/setDialogueSpecs.ts --dry-run   → muestra qué haría
 *   tsx scripts/setDialogueSpecs.ts --apply      → escribe en DB
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma";

// Inlined from elevenlabs.ts to avoid server-only transitive import
const SPEAKER_LABEL_REGEX =
  /^\s*([\p{Lu}][\p{L}\p{M}.'-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'-]*){0,3})\s*:\s+(.*\S)\s*$/u;

function parseDialogueSegments(storyText: string) {
  const cleaned = storyText.replace(/<[^>]+>/g, " ");
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim());
  const segments: { speaker: string; text: string }[] = [];
  let narratorBuffer: string[] = [];
  const flush = () => {
    if (!narratorBuffer.length) return;
    const text = narratorBuffer.join(" ").replace(/\s+/g, " ").trim();
    if (text) segments.push({ speaker: "narrator", text });
    narratorBuffer = [];
  };
  for (const line of lines) {
    if (!line) continue;
    const m = line.match(SPEAKER_LABEL_REGEX);
    if (m) { flush(); segments.push({ speaker: m[1].trim(), text: m[2].trim() }); }
    else narratorBuffer.push(line);
  }
  flush();
  return segments;
}

const JOURNEY_ID = "cmovi4cvi000032q37a4823h3";
const NARRATOR_VOICE = "JW8DGEuLp9WxIS5IdxMM"; // andreti

// Master voice map: displayName → ElevenLabs voiceId
// Indexed lowercase for case-insensitive lookup.
const RAW_VOICE_MAP: Record<string, string> = {
  // Narrator (journey-wide)
  narrator: NARRATOR_VOICE,

  // Colombia; Bogotá (Home & Family)
  marina: "1ZhMG5ZZgJ6XpkOrB8Az",    // luna  (F young CO)
  "julián": "beQfcCW5PgdTQs4cETaz",  // juan  (M young CO); also Andrés (Cartagena)
  "mamá": "SnspHxfVcWQjJgnp6SL3",   // lina_botero (F middle CO)
  vecino: "57D8YIbQSuE3REDPO6Vm",    // horacio (M middle CO, one-off)
  // Bogotá legacy / eliminated characters (only in drafts)
  "don hernán": "57D8YIbQSuE3REDPO6Vm",  // horacio (M middle CO)
  "doña rosa": "3ttovAt5bt3Kk38UGIob",   // alma (F middle LATAM neutral)

  // México; Ciudad de México (Food)
  "sofía": "ewn5JTa3lNPY8QVuZJi6",  // ana_sofia (F young MX)
  renata: "m7yTemJqdIqrcNleANfX",   // ana_maria (F young MX); also Itzel (Oaxaca)
  mateo: "p1Q3ihQuPjyyENa1RGtl",    // tom (M young MX)
  pablo: "DV9FrN0pQkPWIoxW5dvT",    // emilio (M middle MX)
  "tío beto": "DV9FrN0pQkPWIoxW5dvT", // emilio; legacy, same slot as Pablo
  lupita: "D3ws14YxTqcjPaXEOehR",   // azu (F old MX, legacy)

  // Argentina; Buenos Aires (Meeting People)
  camila: "6Mo5ciGH5nWiQacn5FYk",   // roma (F middle AR)
  "tomás": "acHf5gp7AGOY30tJjvD4",  // renzo (M young AR)
  "doña sara": "nAFxIJGj7iSTeltygOfB", // nieve (F old AR, legacy)

  // Colombia; Cartagena (Celebrations)
  daniela: "J8BF9c7OgbHiqagCNoEj",  // carito (F young CO)
  // Andrés shares juan with Julián (Bogotá); never in same story
  "andrés": "beQfcCW5PgdTQs4cETaz", // juan (M young CO)

  // Perú; Lima (Places & Getting Around)
  pilar: "wnQAQM2xwHFeVXM7PQOq",    // sabina (F adult PE)
  diego: "ulJB4yAMefhHYn0FWgGy",    // terry (M young PE)
  beto: "UK00oAtGYBrHBUbesfMv",     // joselo (M middle PE)
  carmen: "dyTONAae6PhdRb3hMKPM",   // elena (F middle PE)
  cobrador: "UK00oAtGYBrHBUbesfMv", // joselo; one-off, never co-appears with Beto
  flaco: "77K94gl6ZCRVTHG8Gi1w",    // patricio (M middle MX, one-off)

  // Chile; Patagonia (Nature & Adventure)
  javiera: "6Gr4AVmTax1pMJO0lHRK",  // catalina (F young CL)
  "benjamín": "6WgXEzo1HGn3i7ilT4Fh", // vicente (M young CL)
  gloria: "prblQcKOdF08ozhxP2mk",   // angela_cl (F middle CL)

  // México; Oaxaca (Legends & Folklore)
  itzel: "m7yTemJqdIqrcNleANfX",    // ana_maria; never in same story as Renata (CDMX)
  rodrigo: "77K94gl6ZCRVTHG8Gi1w",  // patricio; never in same story as Flaco (Lima)

  // México; Oaxaca legacy (Lucía / Don Felipe) from carnitas story
  "lucía": "ewn5JTa3lNPY8QVuZJi6",  // ana_sofia (F young MX, sub)
  "don felipe": "DV9FrN0pQkPWIoxW5dvT", // emilio (M middle MX)
};

// Lowercase lookup
function resolveVoice(speaker: string): string | null {
  return RAW_VOICE_MAP[speaker.toLowerCase()] ?? null;
}

async function run() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (!apply && !dryRun) {
    console.error("Pass --apply or --dry-run.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: JOURNEY_ID },
    select: { id: true, slug: true, title: true, text: true, voiceId: true, dialogueSpec: true, status: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nJourney ${JOURNEY_ID}: ${stories.length} historias\n`);

  let updated = 0;
  let skipped = 0;
  const unknownSpeakers = new Set<string>();

  for (const story of stories) {
    if (!story.text) {
      console.log(`  SKIP ${story.slug} (sin texto)`);
      skipped++;
      continue;
    }

    // Skip if already has correct spec (andreti narrator)
    const existingSpec = story.dialogueSpec as Array<{ voice: string; speaker: string; text: string }> | null;
    const firstNarrator = existingSpec?.find(s => s.speaker === "narrator");
    if (firstNarrator?.voice === NARRATOR_VOICE) {
      console.log(`  OK   ${story.slug} (spec correcto, andreti)`);
      skipped++;
      continue;
    }

    const segments = parseDialogueSegments(story.text);
    const spec = segments.map(seg => {
      const voice = seg.speaker === "narrator"
        ? NARRATOR_VOICE
        : resolveVoice(seg.speaker) ?? NARRATOR_VOICE;
      if (seg.speaker !== "narrator" && !resolveVoice(seg.speaker)) {
        unknownSpeakers.add(`${story.slug}::${seg.speaker}`);
      }
      return { speaker: seg.speaker, text: seg.text, voice };
    });

    const speakerList = [...new Set(spec.map(s => s.speaker))].join(", ");
    if (dryRun) {
      console.log(`  WOULD UPDATE ${story.slug} [${story.status}]`);
      console.log(`    speakers: ${speakerList}`);
      console.log(`    segments: ${spec.length}`);
    } else {
      await prisma.journeyStory.update({
        where: { id: story.id },
        data: {
          dialogueSpec: spec as any,
          voiceId: NARRATOR_VOICE,
        },
      });
      console.log(`  UPDATED ${story.slug} [${story.status}]; ${spec.length} segs, speakers: ${speakerList}`);
    }
    updated++;
  }

  if (unknownSpeakers.size > 0) {
    console.log(`\n⚠ Speakers sin voz asignada (cayeron a narrator):`);
    unknownSpeakers.forEach(s => console.log(`  ${s}`));
  }

  console.log(`\n${dryRun ? "[dry-run] " : ""}${updated} updated, ${skipped} skipped.`);
  await prisma.$disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
