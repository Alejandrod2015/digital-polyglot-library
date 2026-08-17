import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { multiVoiceGuardError } from "../src/lib/multiVoiceGuard";
import { applyNarrationPostProcess } from "../src/lib/narrationPostProcess";

const J = "cmqp6hal8000032cb4ywfs0gc";
const SLUGS = ["se-fue-la-luz", "una-caja-vieja", "por-fin-se-abre-la-puerta"];
const AMBIENT = "lluvia";

(async () => {
  const p = new PrismaClient();
  for (const slug of SLUGS) {
    const story = await p.journeyStory.findFirst({ where: { journeyId: J, slug }, include: { journey: true } });
    if (!story?.text || !story.title) { console.log(`!! ${slug}: sin texto`); continue; }
    const g = multiVoiceGuardError({ storyText: story.text, dialogueSpec: story.dialogueSpec });
    if (g) { console.log(`!! ${slug} GUARD: ${g}`); continue; }
    const spec = story.dialogueSpec as Array<{ speaker: string; voice: string }>;
    const voiceMap: Record<string, string> = {};
    for (const s of spec) if (s.speaker && s.voice) voiceMap[s.speaker.toLowerCase()] = s.voice;

    console.log(`\n=== ${slug} === voiceMap: ${Object.entries(voiceMap).map(([k, v]) => `${k}=${v.slice(0,6)}`).join(", ")}`);
    await p.journeyStory.update({ where: { id: story.id }, data: { audioStatus: "generating", ambientTag: AMBIENT } });

    const r = await generateAndUploadMultiVoiceAudio({
      storyText: story.text, title: story.title, voiceMap,
      language: story.journey.language ?? undefined, disableStitching: true,
    });
    if (!r) { console.log(`!! ${slug}: null`); continue; }
    await p.journeyStory.update({
      where: { id: story.id },
      data: { audioUrl: r.url, audioSegments: r.audioSegments as any, audioFilename: r.filename, audioStatus: "ready",
        voiceId: r.speakerVoiceMap?.narrator ?? voiceMap.narrator ?? null,
        audioQaStatus: r.audioQa?.status ?? null, audioQaScore: r.audioQa?.score ?? null },
    });
    await generateWordTimingsForStory(story.id);
    const pp = await applyNarrationPostProcess({ storyId: story.id, sourceUrl: r.url, ambientTag: AMBIENT, tempo: 1.0 });
    console.log(`ok ${slug}: ${pp.audioFilename}`);
  }
  await p.$disconnect();
})().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
