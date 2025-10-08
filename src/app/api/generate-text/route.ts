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
You are an expert language teacher and long story writer.
Write a long engaging story for a ${level} student learning ${language}${regionClause}.
The topic of the story is "${topic}".

Requirements:

Narrative style: Use a third-person narrator who is not a character in the story. The narration should feel natural, vivid, and close to the reader.
The narrator may briefly imitate a character’s inner voice or thoughts, as if telling the story to friends, but must remain external and coherent.

Words to wrap:

- Wrap around 25-30 different items that naturally fit in the story, marking only the first occurrence of each with
<span class='vocab-word' data-word='original-word'>original-word</span>.
- The amount of items you wrap should be the same as the amount of items in the vocab list.
- Prioritize ${focus.toLowerCase()} when choosing words and expressions to wrap. For example, if the focus is "expressions", 
wrap most of the expressions. 
- Include all items you wrap in the vocab list.
- Don't include words that are writen the same or very similar to English unless they have a different meaning or usage in ${language}. (Examples but not exclusively: hotel, computer, budget, volleyball, restaurant, etc)


Return your answer ONLY as valid JSON, with no explanations or extra text.
The JSON must have exactly this structure:

{
  "title": "string — a concise story title",
  "text": "string — the story in HTML format, with <p> for paragraphs and <span class='vocab-word' data-word='original-word'>original-word</span> around key terms (the story text must remain entirely in ${language}, do NOT include translations inside the spans)",
  "vocab": [
    { "word": "string — word or expression", "definition": "string — short translation or explanation written in English" }
  ]
}

Rules:

- All vocabulary definitions must be written in clear English, regardless of the story language.
- Do NOT include Markdown or extra commentary.
- Output ONLY valid JSON.

Important:

- Don't list extremely simple, obvious, peoples own names or nouns that are written the same or similar in English (Examples but not exclusively: hotel, computer, budget, volleyball, etc) 
that most learners would already understand.

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