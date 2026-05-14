/**
 * One-shot: download current Apfelkuchen MP3, run boundary trim, re-upload, update DB.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma";
import { trimAudioBoundariesByAlignment } from "../src/lib/audioBoundaryTrim";
import { uploadPublicObject, getPublicObjectUrl } from "../src/lib/objectStorage";
import { parseDialogueSegments } from "../src/lib/elevenlabs";

async function main() {
  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findFirst({
    where: { slug: "apfelkuchen-in-wedding-2" },
  });
  if (!story || !story.audioUrl || !story.text) throw new Error("not found");

  console.log("Downloading", story.audioUrl);
  const resp = await fetch(story.audioUrl);
  const audioBuffer = Buffer.from(await resp.arrayBuffer());
  console.log("Buffer size:", audioBuffer.length);

  // plainText for aeneas: title + each segment text joined.
  const segs = parseDialogueSegments(story.text);
  const plainText = [story.title, ...segs.map((s) => s.text)].join(" ");
  console.log("plainText length:", plainText.length);

  const trimmed = await trimAudioBoundariesByAlignment({
    audioBuffer,
    plainText,
    language: "german",
    gapThresholdSec: 0.25,
    replacementSilenceSec: 0.35,
  });
  if (!trimmed) {
    console.error("Trim failed; keeping original");
    process.exit(1);
  }
  console.log("Trimmed size:", trimmed.length, "(was", audioBuffer.length, ")");

  const key = `media/generated/audio/Apfelkuchen_in_Wedding_multivoice_trimmed_${Date.now()}.mp3`;
  await uploadPublicObject({ key, body: trimmed, contentType: "audio/mpeg" });
  const url = getPublicObjectUrl(key);
  if (!url) throw new Error("upload returned no url");
  console.log("Uploaded:", url);

  await prisma.journeyStory.update({
    where: { id: story.id },
    data: {
      audioUrl: url,
      audioFilename: key.split("/").pop()!,
      audioStatus: "ready",
    },
  });
  console.log("DB updated.");
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
