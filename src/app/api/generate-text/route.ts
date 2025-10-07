import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    // Parsear body
    let body = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid or missing JSON body" },
        { status: 400 }
      );
    }

    // DESPUÉS
const {
  language = "Spanish",
  region, // ❗ sin default
  level = "intermediate",
  focus = "verbs",
  topic = "daily life",
} = body as {
  language?: string
  region?: string
  level?: string
  focus?: string
  topic?: string
}

const regionClause = region ? `, specifically from ${region}` : ""
const regionRule = region ? `- Make sure vocabulary reflects usage common in ${region}.` : ""

const prompt = `
You are an expert language teacher and short story writer.
Write a short story for a ${level} student learning ${language}${regionClause}.
Focus on using ${focus} naturally within the story.
The topic of the story is "${topic}".

Return your answer ONLY as valid JSON, with no explanations or extra text.
The JSON must have exactly this structure:

{
  "title": "string — a concise story title",
  "text": "string — the story in HTML format, with <p> for paragraphs and <span class='vocab-word' data-word='original-word'>translated-word</span> around key terms",
  "vocab": [
    { "word": "string — word or expression", "definition": "string — short translation or explanation" }
  ]
}

Rules:
- The story must be natural, simple, and interesting for a ${level} ${language} learner.
${regionRule}
- Do NOT include Markdown or extra commentary.
- Output ONLY valid JSON.
`
;


    // Llamada a OpenAI
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
      return NextResponse.json(
        { error: "No content returned from OpenAI" },
        { status: 502 }
      );
    }

    // Validar JSON antes de devolverlo
    try {
      JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON format returned from model", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Error generating text:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to generate story", details: err.message },
      { status: 500 }
    );
  }
}
