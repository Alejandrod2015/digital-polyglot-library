import { NextResponse } from "next/server";
import { generateAndUploadAudio } from "@/lib/elevenlabs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { storyId, text, title, language, region } = await req.json();

    if (!storyId || !text || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    console.log("[audio-job] Generating audio for story:", storyId);

    // 🔹 generateAndUploadAudio ahora devuelve { url, filename }
    const audioResult = await generateAndUploadAudio(text, title, language, region);

    if (!audioResult || !audioResult.url) {
      return NextResponse.json(
        { error: "Audio generation failed" },
        { status: 500 }
      );
    }

    // ✅ Actualizar la historia en la base de datos
    await prisma.userStory.update({
      where: { id: storyId },
      data: {
        audioUrl: audioResult.url,
        audioFilename: audioResult.filename || null,
      },
    });

    console.log("[audio-job] Audio generated and uploaded for story:", storyId);

    return NextResponse.json({
      message: "Audio generated",
      audioUrl: audioResult.url,
      filename: audioResult.filename,
    });
  } catch (error) {
    console.error("[audio-job] Error:", error);
    return NextResponse.json(
      { error: "Failed to process audio job" },
      { status: 500 }
    );
  }
}
