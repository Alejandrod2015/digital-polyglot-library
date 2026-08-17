import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { multiVoiceGuardError } from "../src/lib/multiVoiceGuard";
import { applyNarrationPostProcess } from "../src/lib/narrationPostProcess";

const J = "cmqp6hal8000032cb4ywfs0gc";
const SLUG = "se-fue-la-luz";
const AMBIENT = "lluvia";

(async () => {
  const p = new PrismaClient();
  const story = await p.journeyStory.findFirst({ where: { journeyId: J, slug: SLUG }, include: { journey: true } });
  if (!story?.text || !story.title) throw new Error("no text/title");
  const g = multiVoiceGuardError({ storyText: story.text, dialogueSpec: story.dialogueSpec });
  if (g) throw new Error("GUARD: " + g);

  const spec = story.dialogueSpec as Array<{ speaker: string; voice: string }>;
  const voiceMap: Record<string, string> = {};
  for (const s of spec) if (s.speaker && s.voice) voiceMap[s.speaker.toLowerCase()] = s.voice;
  console.log("voiceMap:", JSON.stringify(voiceMap));
  await p.journeyStory.update({ where: { id: story.id }, data: { audioStatus: "generating", ambientTag: AMBIENT } });

  // 1) synth + upload dry multivoice
  const r = await generateAndUploadMultiVoiceAudio({
    storyText: story.text, title: story.title, voiceMap,
    language: story.journey.language ?? undefined, disableStitching: true,
  });
  if (!r) throw new Error("multi-voice null");
  console.log("gen:", r.filename);
  await p.journeyStory.update({
    where: { id: story.id },
    data: { audioUrl: r.url, audioSegments: r.audioSegments as any, audioFilename: r.filename, audioStatus: "ready",
      voiceId: r.speakerVoiceMap?.narrator ?? voiceMap.narrator ?? null,
      audioQaStatus: r.audioQa?.status ?? null, audioQaScore: r.audioQa?.score ?? null },
  });

  // 2) word timings + segments FIRST (so ambient can compute narrator ranges)
  await generateWordTimingsForStory(story.id);
  console.log("word timings: ok");

  // 3) ambient under dialogue only (segments now exist -> ducks narrator), no tempo change
  const pp = await applyNarrationPostProcess({ storyId: story.id, sourceUrl: r.url, ambientTag: AMBIENT, tempo: 1.0 });
  console.log("ambient:", pp.appliedAmbientTag, "| file:", pp.audioFilename);
  console.log("URL:", pp.audioUrl);
  await p.$disconnect();
})().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
