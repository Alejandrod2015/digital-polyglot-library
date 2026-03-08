import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Body = {
  title?: string;
  language?: string;
  region?: string;
  level?: string;
  focus?: string;
  topic?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const language = typeof body.language === "string" && body.language.trim() ? body.language.trim() : "Spanish";
    const region = typeof body.region === "string" ? body.region.trim() : "";
    const level = typeof body.level === "string" && body.level.trim() ? body.level.trim() : "intermediate";
    const focus = typeof body.focus === "string" && body.focus.trim() ? body.focus.trim() : "Everyday conversation";
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }

    const regionClause = region ? ` Set it specifically in ${region}.` : "";
    const topicClause = topic ? ` The topic is "${topic}".` : "";

    const prompt = `
You write short story synopses for a language-learning app.

Write one concise synopsis in English based on this story title: "${title}".
The final story will be in ${language} for a ${level} learner.${regionClause}${topicClause}
The learning focus is: "${focus}".

Requirements:
- 2-4 sentences only.
- 45-90 words total.
- Clearly mention the main character or characters.
- Clearly describe the central situation, conflict, or narrative tension.
- Include enough concrete detail to guide later story and cover generation.
- Do not write marketing copy.
- Do not mention "the reader" or "language learners".
- Do not list bullet points.
- Do not sound generic or vague.

Return ONLY the synopsis text.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: "You write concise, vivid story synopses. Return plain text only." },
        { role: "user", content: prompt },
      ],
    });

    const result = response.choices[0]?.message?.content?.trim();
    if (!result) {
      return NextResponse.json({ error: "No synopsis returned" }, { status: 502 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
