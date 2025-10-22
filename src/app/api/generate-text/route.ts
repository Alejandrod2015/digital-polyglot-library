import { NextResponse } from "next/server";
import OpenAI from "openai";
import { generateAndUploadAudio } from "@/lib/elevenlabs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type StoryJSON = {
  title: string;
  text: string;
  vocab: { word: string; definition: string }[];
};

function isValidStoryJSON(data: unknown): data is StoryJSON {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as StoryJSON).title === "string" &&
    typeof (data as StoryJSON).text === "string" &&
    Array.isArray((data as StoryJSON).vocab)
  );
}

export async function POST(req: Request) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid or missing JSON body" }, { status: 400 });
    }

    const {
      language = "Spanish",
      region, // sin default
      level = "intermediate",
      focus = "verbs",
      topic = "daily life",
    } = body as {
      language?: string;
      region?: string;
      level?: string;
      focus?: string;
      topic?: string;
    };

    const regionClause = region ? `, specifically from ${region}` : "";

    const prompt = `
You are an expert language teacher and long story writer.
Write a long engaging story for a ${level} student learning ${language}${regionClause}.
The topic of the story is "${topic}".
All vocabulary definitions must be written in clear English, regardless of the story language.
Wrap each paragraph inside <blockquote> ... </blockquote>.

Requirements:
Use a close third-person narrator who sometimes slips into the characters’ own thoughts and feelings, so the narration flows naturally between observation and inner voice.

Words to wrap:
- Wrap around 25-30 different items that naturally fit in the story, marking only the first occurrence of each with
<span class='vocab-word' data-word='original-word'>original-word</span>.
- The amount of items you wrap should be the same as the amount of items in the vocab list.
- Prioritize ${focus.toLowerCase()} when choosing words and expressions to wrap.

Return ONLY valid JSON:
{
  "title": "string",
  "text": "string",
  "vocab": [{ "word": "string", "definition": "string" }]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        { role: "system", content: "You are a creative story generator for language learners." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ error: "No content returned from OpenAI" }, { status: 502 });
    }

    // Validar, pero mantener el contrato: content debe seguir siendo string JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "Invalid JSON format returned from model", raw: content }, { status: 500 });
    }
    if (!isValidStoryJSON(parsed)) {
      return NextResponse.json({ error: "Invalid structure in model output", raw: parsed }, { status: 500 });
    }

    const { title, text } = parsed as StoryJSON;

    // Generar y subir audio (no afecta al contrato de respuesta si falla)
    let audioAssetId: string | null = null;
    try {

      console.log("[api] generate-text called with", language, region);


      audioAssetId = await generateAndUploadAudio(text, title, language, region);

    } catch (e) {
      console.error("[audio] generation/upload failed:", e);
    }

    // 👉 Devolver exactamente como antes: content = string JSON
    //    + un campo adicional opcional que no rompe al Studio.
    return NextResponse.json({ content, audioAssetId });
  } catch (error) {
    console.error("Error generating text:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to generate story", details: err.message },
      { status: 500 }
    );
  }
}
