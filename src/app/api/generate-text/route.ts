import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid or missing JSON body" },
        { status: 400 }
      );
    }

    const { language = "German", level = "intermediate", theme = "urban life" } = body as {
      language?: string;
      level?: string;
      theme?: string;
    };

    const prompt = `
You are an expert language teacher and short story writer.
Write a short story for a ${level} student learning ${language}.
The theme of the story is "${theme}".
Include a title, a short story text, and a list of useful vocabulary items in the format:
vocab: [
  { word: "example", definition: "translation or explanation" }
]
Keep it simple, natural, and educational.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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

    return NextResponse.json({ content });
  } catch (error: any) {
    console.error("Error generating text:", error);
    return NextResponse.json(
      { error: "Failed to generate story", details: error.message },
      { status: 500 }
    );
  }
}
