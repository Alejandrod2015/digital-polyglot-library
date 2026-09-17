import { NextResponse } from "next/server";
import { generateAndUploadAudio } from "@/lib/elevenlabs";
import { prisma } from "@/lib/prisma";
import { syncCreateStoryMirror } from "@/lib/createStoryMirror";
import {
  INTERNAL_AUDIO_TOKEN_HEADER,
  verifyInternalAudioToken,
} from "@/lib/internalApiAuth";
import { signAudioUrl } from "@/lib/mediaSigning";

export async function POST(req: Request) {
  let storyId: string | undefined;
  try {
    const body = await req.json() as {
      storyId?: string;
      text?: string;
      title?: string;
      language?: string;
      region?: string;
    };
    storyId = body.storyId;
    const { text, title, language, region } = body;

    if (!storyId || !text || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Solo el fetch interno de generate-story puede disparar sintesis: cada
    // llamada gasta creditos de ElevenLabs y este endpoint estaba abierto.
    if (!verifyInternalAudioToken(storyId, req.headers.get(INTERNAL_AUDIO_TOKEN_HEADER))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[audio-job] Generating audio for story:", storyId);

    await prisma.userStory.update({
      where: { id: storyId },
      data: {
        audioStatus: "generating",
      },
    });

    // 🔹 generateAndUploadAudio ahora devuelve { url, filename }
    const audioResult = await generateAndUploadAudio(text, title, language, region);

    if (!audioResult || !audioResult.url) {
      return NextResponse.json(
        { error: "Audio generation failed" },
        { status: 500 }
      );
    }

    // ✅ Actualizar la historia en la base de datos
    const updatedStory = await prisma.userStory.update({
      where: { id: storyId },
      data: {
        audioUrl: audioResult.url,
        audioSegments: audioResult.audioSegments,
        audioFilename: audioResult.filename || null,
        audioStatus: "ready",
      },
    });

    try {
      await syncCreateStoryMirror(updatedStory);
    } catch (mirrorError) {
      console.warn("[create-story-mirror] Audio sync failed:", mirrorError);
    }

    console.log("[audio-job] Audio generated and uploaded for story:", storyId);

    return NextResponse.json({
      message: "Audio generated",
      // La base guarda la url canonica (audioResult.url); al cliente le sale
      // firmada. Las dos son la misma pista, distinta puerta.
      audioUrl: signAudioUrl(audioResult.url),
      audioSegments: audioResult.audioSegments,
      filename: audioResult.filename,
    });
  } catch (error) {
    console.error("[audio-job] Error:", error);
    if (storyId) {
      try {
        await prisma.userStory.update({
          where: { id: storyId },
          data: {
            audioStatus: "failed",
          },
        });
      } catch (updateError) {
        console.error("[audio-job] Failed to mark audio status as failed:", updateError);
      }
    }
    return NextResponse.json(
      { error: "Failed to process audio job" },
      { status: 500 }
    );
  }
}
