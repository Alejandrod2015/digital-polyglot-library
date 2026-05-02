import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI();

type TranslationPayload = {
  word?: string;
  snippet?: string;
};

export async function POST(req: Request) {
  try {
    const { word, snippet } = (await req.json()) as TranslationPayload;

    if (!word && !snippet) {
      return NextResponse.json({ contextTranslation: null, wordTranslations: [] });
    }

    const userMessage = [
      "Translate the following into English. Auto-detect the source language.",
      word ? `WORD: "${word}"` : null,
      snippet ? `CONTEXT SNIPPET: "${snippet}"` : null,
      word && snippet
        ? "Translate the WORD considering how it appears in the snippet for sense disambiguation."
        : null,
      "",
      "Return ONLY valid JSON in this shape (omit keys you did not translate):",
      "{",
      word ? `  "word": "<1-3 word english equivalent, lowercase unless proper noun>",` : null,
      snippet ? `  "snippet": "<natural english translation, preserve register>"` : null,
      "}",
    ]
      .filter(Boolean)
      .join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a precise translator. Return only valid JSON with the requested keys. No commentary, no extra text.",
        },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 200,
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content) as { word?: string; snippet?: string };

    const ordered: string[] = [];
    if (word && parsed.word) ordered.push(parsed.word);
    if (snippet && parsed.snippet) ordered.push(parsed.snippet);

    return NextResponse.json({
      wordTranslations: ordered.length > 0 ? [ordered[0]] : [],
      contextTranslation:
        ordered.length > 1 ? ordered[1] : ordered[0] || null,
    });
  } catch (err: unknown) {
    console.error("Error in /api/translate:", err);

    let message = "Unknown error";
    if (err instanceof Error) {
      message = err.message;
    }

    return NextResponse.json(
      { error: "Translation failed", details: message },
      { status: 500 }
    );
  }
}
