import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { spawn } from "node:child_process";
import OpenAI from "openai";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;

const SUPPORTED_LANGUAGES = ["spanish", "english", "german", "french", "italian", "portuguese"];
const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/m4a", "audio/x-m4a", "audio/mp4"];

function clonedVoicesDir(): string {
  return join(process.cwd(), "scripts", "tts", "cloned-voices");
}

async function transcodeToWav(srcPath: string, dstPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", srcPath, "-ac", "1", "-ar", "24000", "-codec:a", "pcm_s16le", dstPath]);
    const errs: Buffer[] = [];
    child.stderr.on("data", (c) => errs.push(c));
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${Buffer.concat(errs).toString().slice(-300)}`));
    });
  });
}

async function transcribeWithWhisper(wavPath: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const fs = await import("node:fs");
  try {
    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(wavPath) as unknown as File,
      model: "whisper-1",
    });
    return typeof transcript.text === "string" ? transcript.text : null;
  } catch (err) {
    console.error("[cloned-voices] Whisper transcription failed:", err);
    return null;
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const voices = await prisma.clonedVoice.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ voices });
}

export async function POST(request: Request) {
  if (process.env.LOCAL_TTS_ENABLED !== "1")
    return NextResponse.json({ error: "Local TTS not enabled in this env." }, { status: 503 });

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let formData: FormData;
  try { formData = await request.formData(); } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = formData.get("audio") as File | null;
  const name = (formData.get("name") as string | null)?.trim();
  const language = (formData.get("language") as string | null)?.trim();
  const region = (formData.get("region") as string | null)?.trim() || null;
  const gender = (formData.get("gender") as string | null)?.trim() || "f";
  const providedRefText = (formData.get("refText") as string | null)?.trim() || null;

  if (!file) return NextResponse.json({ error: "audio file is required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!language || !SUPPORTED_LANGUAGES.includes(language))
    return NextResponse.json({ error: `language must be one of: ${SUPPORTED_LANGUAGES.join(", ")}` }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "audio file is empty" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "audio file too large (max 10 MB)" }, { status: 400 });
  if (!ALLOWED_AUDIO_TYPES.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|mp4)$/i))
    return NextResponse.json({ error: `unsupported audio type: ${file.type}` }, { status: 400 });

  await mkdir(clonedVoicesDir(), { recursive: true });

  // 1) Save uploaded file with original ext, 2) transcode to mono 24kHz WAV (F5-friendly)
  const id = (await import("crypto")).randomBytes(12).toString("hex");
  const origExt = extname(file.name) || ".mp3";
  const tmpOriginal = join(clonedVoicesDir(), `${id}_orig${origExt}`);
  const finalWav = join(clonedVoicesDir(), `${id}.wav`);

  try {
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(tmpOriginal, Buffer.from(arrayBuffer));
    await transcodeToWav(tmpOriginal, finalWav);

    let refText = providedRefText;
    if (!refText) {
      const transcribed = await transcribeWithWhisper(finalWav);
      if (!transcribed) {
        await unlink(finalWav).catch(() => {});
        return NextResponse.json(
          { error: "No refText provided and Whisper transcription failed (check OPENAI_API_KEY)" },
          { status: 400 }
        );
      }
      refText = transcribed;
    }

    const created = await prisma.clonedVoice.create({
      data: {
        name,
        language,
        region,
        gender,
        refAudioPath: finalWav,
        refText,
        createdBy: user.primaryEmailAddress.emailAddress,
      },
    });
    return NextResponse.json({ ok: true, voice: created });
  } catch (err) {
    await unlink(finalWav).catch(() => {});
    console.error("[cloned-voices] create failed:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Failed to create cloned voice", details: msg }, { status: 500 });
  } finally {
    await unlink(tmpOriginal).catch(() => {});
  }
}
