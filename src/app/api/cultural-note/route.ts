import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI();

export async function POST(req: Request) {
  try {
    const { word = "", snippet = "", bookId = "", storyId = "" } = await req.json();

    if (!word) {
      return NextResponse.json(
        { error: "Missing 'word' in request body" },
        { status: 400 }
      );
    }

    const prompt = `
You are a cultural and linguistic assistant.
The user will provide a word and its context (book + story + snippet).

Your task:
- If the word has cultural, historical, or regional significance in the given language or context (food, festivals, idioms, customs, cultural objects), provide a VERY short cultural note in English.
- Don't add a note if the word is a common noun, verb, adjective, or adverb without special cultural meaning.
- The note must be maximum 2 sentences, simple wording, no longer than 3 lines.
- If the word has no notable cultural significance, return an empty string.

Word: "${word}"
Context snippet: "${snippet}"
Book: "${bookId}", Story: "${storyId}"

Return ONLY valid JSON in this exact format:
{
  "culturalNote": "..."
}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 120,
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return NextResponse.json({
      culturalNote: parsed.culturalNote || "",
    });
  } catch (err: unknown) {
    console.error("Error in /api/cultural-note:", err);

    let message = "Unknown error";
    if (err instanceof Error) {
      message = err.message;
    }

    return NextResponse.json(
      {
        error: "Cultural note generation failed",
        details: message,
      },
      { status: 500 }
    );
  }
}
