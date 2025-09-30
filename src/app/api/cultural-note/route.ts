import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

// El cliente ya toma la clave de process.env.OPENAI_API_KEY
const client = new OpenAI();

export async function POST(req: Request) {
  try {
    const { word = "" } = await req.json();

    if (!word) {
      return NextResponse.json(
        { error: "Missing 'word' in request body" },
        { status: 400 }
      );
    }

    const prompt = `
You are a cultural and linguistic assistant.
The user will provide a word in any language.

Your task:
- If the word has cultural, historical, or regional significance (food, festivals, idioms, customs, cultural objects), provide a VERY short cultural note in English.
- The note must be maximum 2 sentences, with simple wording, no longer than 3 lines.
- If the word has no notable cultural significance, return an empty string.

Return ONLY valid JSON in this exact format:
{
  "culturalNote": "..."
}

Word: "${word}"
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 120, // fuerza brevedad
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return NextResponse.json({
      culturalNote: parsed.culturalNote || "",
    });
  } catch (err: any) {
    console.error("Error in /api/cultural-note:", err);

    return NextResponse.json(
      {
        error: "Cultural note generation failed",
        details: err.message || err.toString(),
      },
      { status: 500 }
    );
  }
}
