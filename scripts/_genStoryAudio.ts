import { config } from "dotenv"; config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { multiVoiceGuardError } from "../src/lib/multiVoiceGuard";

const STORY_ID = process.argv[2];

(async () => {
  if (!STORY_ID) throw new Error("usage: _genStoryAudio.ts <storyId>");
  const p = new PrismaClient();
  const story = await p.journeyStory.findUnique({ where: { id: STORY_ID }, include: { journey: true } });
  if (!story?.text || !story.title) throw new Error("no text/title");
  console.log("Story:", story.title, "| lang:", story.journey.language);

  const g = multiVoiceGuardError({ storyText: story.text, dialogueSpec: story.dialogueSpec });
  if (g) throw new Error("GUARD blocked: " + g);

  const spec = story.dialogueSpec as Array<{ speaker: string; voice: string; text: string }>;
  const voiceMap: Record<string, string> = {};
  for (const seg of spec) if (seg.speaker && seg.voice) voiceMap[seg.speaker.toLowerCase()] = seg.voice;
  console.log("voiceMap:", voiceMap);

  await p.journeyStory.update({ where: { id: STORY_ID }, data: { audioStatus: "generating" } });

  const result = await generateAndUploadMultiVoiceAudio({
    storyText: story.text,
    title: story.title,
    voiceMap,
    language: story.journey.language ?? undefined,
    disableStitching: true,
  });
  if (!result) throw new Error("multi-voice returned null");
  console.log("GENERATED:", result.filename, "| multivoice:", result.url.includes("multivoice"));

  await p.journeyStory.update({
    where: { id: STORY_ID },
    data: {
      audioUrl: result.url,
      audioSegments: result.audioSegments as any,
      audioFragments: result.fragments as any, // ground-truth sections → audio editor (counter/regen). NUNCA omitir.
      audioFilename: result.filename,
      audioStatus: "ready",
      voiceId: result.speakerVoiceMap?.narrator ?? voiceMap.narrator ?? null,
      audioQaStatus: result.audioQa?.status ?? null,
      audioQaScore: result.audioQa?.score ?? null,
      audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
    },
  });
  console.log("DB updated");

  try { await generateWordTimingsForStory(STORY_ID); console.log("WORD TIMINGS: ok"); }
  catch (e) { console.warn("WORD TIMINGS failed (best-effort):", e instanceof Error ? e.message : e); }

  console.log("URL:", result.url);
  await p.$disconnect();
})().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
