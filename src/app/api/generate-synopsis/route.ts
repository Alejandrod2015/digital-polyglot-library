import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildSanityCorsHeaders } from "@/lib/sanityCors";
import { cefrPromptLabel } from "@/lib/cefr";
import { buildVariantPromptClause, normalizeVariant } from "@/lib/languageVariant";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Body = {
  title?: string;
  language?: string;
  variant?: string;
  region?: string;
  cefrLevel?: string;
  level?: string;
  focus?: string;
  topic?: string;
};

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = buildSanityCorsHeaders(origin);

  try {
    const body = (await req.json()) as Body;

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const language = typeof body.language === "string" && body.language.trim() ? body.language.trim() : "Spanish";
    const variant = typeof body.variant === "string" ? body.variant.trim() : "";
    const region = typeof body.region === "string" ? body.region.trim() : "";
    const level = typeof body.level === "string" && body.level.trim() ? body.level.trim() : "intermediate";
    const cefrLevel = typeof body.cefrLevel === "string" && body.cefrLevel.trim() ? body.cefrLevel.trim() : "";
    const focus = typeof body.focus === "string" && body.focus.trim() ? body.focus.trim() : "Everyday conversation";
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const learnerProfile = cefrPromptLabel(cefrLevel, level);
    const variantClause = buildVariantPromptClause(language, normalizeVariant(variant));

    if (!title) {
      return NextResponse.json({ error: "Missing title" }, { status: 400, headers: corsHeaders });
    }

    const regionClause = region ? ` Set it specifically in ${region}.` : "";
    const topicClause = topic ? ` The topic is "${topic}".` : "";

    const prompt = `
You write short story synopses for a language-learning app.

Write one concise synopsis in English based on this story title: "${title}".
The final story will be in ${language} for a ${learnerProfile} learner.${regionClause}${topicClause}
${variantClause}
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
      return NextResponse.json({ error: "No synopsis returned" }, { status: 502, headers: corsHeaders });
    }

    return NextResponse.json({ result }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: buildSanityCorsHeaders(origin),
  });
}
