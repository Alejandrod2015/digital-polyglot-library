/**
 * After the Python re-roll pipeline writes /tmp/mole_concat.wav, normalize
 * loudness, encode MP3, upload to R2, update DB.
 */
import { prisma } from "@/lib/prisma";
import { uploadPublicObject } from "@/lib/objectStorage";
import { spawn } from "child_process";
import { readFileSync } from "fs";

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let err = "";
    proc.stderr.on("data", (c) => { err += c.toString(); });
    proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${err.slice(0, 400)}`)));
    proc.on("error", reject);
  });
}

async function main() {
  const story = await prisma.journeyStory.findFirst({ where: { slug: "mole-en-san-angel" } });
  if (!story) throw new Error("Mole story not found");

  const concat = "/tmp/mole_concat.wav";
  const final = "/tmp/mole_final.mp3";
  await ffmpeg([
    "-y", "-loglevel", "error",
    "-i", concat,
    "-af", "dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5",
    "-codec:a", "libmp3lame", "-b:a", "128k",
    final,
  ]);

  const buf = readFileSync(final);
  const filename = `${story.slug}_${Date.now()}.mp3`;
  const up = await uploadPublicObject({
    key: `media/generated/audio/${filename}`,
    body: buf,
    contentType: "audio/mpeg",
  });
  if (!up?.url) throw new Error("upload failed");

  await prisma.journeyStory.update({
    where: { id: story.id },
    data: {
      audioUrl: up.url,
      audioFilename: filename,
      audioStatus: "ready",
      voiceId: "qwen/es-Dylan-v3",
    },
  });
  console.log(`✅ updated. audioUrl=${up.url}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
