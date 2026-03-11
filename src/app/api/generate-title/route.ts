import { NextResponse } from "next/server";
import OpenAI from "openai";
import { groq } from "next-sanity";
import { client } from "@/sanity/lib/client";
import { buildSanityCorsHeaders } from "@/lib/sanityCors";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Body = {
  documentId?: string;
  language?: string;
  region?: string;
  topic?: string;
  synopsis?: string;
};

function normalizeTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tooSimilarToExisting(title: string, existingTitles: string[]): boolean {
  const normalized = normalizeTitle(title);
  if (!normalized) return true;
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  if (tokens.size === 0) return true;

  return existingTitles.some((existing) => {
    const normalizedExisting = normalizeTitle(existing);
    if (!normalizedExisting) return false;
    if (normalizedExisting === normalized) return true;
    if (normalizedExisting.includes(normalized) || normalized.includes(normalizedExisting)) return true;

    const existingTokens = new Set(normalizedExisting.split(" ").filter(Boolean));
    let overlap = 0;
    for (const token of tokens) {
      if (existingTokens.has(token)) overlap += 1;
    }
    const denominator = Math.max(tokens.size, existingTokens.size);
    return denominator > 0 && overlap / denominator >= 0.8;
  });
}

async function getExistingGeneratedTitles(documentId?: string): Promise<string[]> {
  const query = groq`*[_type in ["story", "standaloneStory"] && defined(title)]{
    _id,
    title
  }`;

  const rows = await client.fetch<Array<{ _id?: string; title?: string }>>(query);
  const excludedIds = documentId ? new Set([documentId, `drafts.${documentId}`]) : null;
  return rows
    .filter((row) => !(excludedIds && typeof row._id === "string" && excludedIds.has(row._id)))
    .map((row) => (typeof row.title === "string" ? row.title.trim() : ""))
    .filter((title) => title.length > 0);
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = buildSanityCorsHeaders(origin);

  try {
    const body = (await req.json()) as Body;

    const language = typeof body.language === "string" && body.language.trim() ? body.language.trim() : "Spanish";
    const region = typeof body.region === "string" ? body.region.trim() : "";
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const synopsis = typeof body.synopsis === "string" ? body.synopsis.trim() : "";
    const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";

    const existingTitles = await getExistingGeneratedTitles(documentId || undefined);
    let feedback = "";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const retryBlock =
        attempt === 0
          ? ""
          : `\nAvoid titles close to these existing ones: ${existingTitles.slice(0, 80).join(" | ")}.\nPrevious attempt failed uniqueness: ${feedback}`;

      const prompt = `
You create strong story titles for a language-learning app.

Write ONE title in ${language}.
${region ? `The title should feel grounded in ${region}.` : ""}
${topic ? `The story topic is "${topic}".` : ""}
${synopsis ? `Use this synopsis to infer the characters, conflict, and setting: "${synopsis}".` : ""}

Requirements:
- 2 to 6 words.
- Interesting, specific, and memorable.
- If possible, anchor it in a real cultural or regional element from the country/region.
- Avoid generic titles like "A Day in...", "The Story of...", "A Problem", "Important Decision".
- Avoid cliché thriller formulas like "The Mystery of..." unless truly justified by the synopsis.
- Avoid repeating the same noun pairings or themes already common in existing titles.
- Return ONLY the title text, with no quotes or explanation.
${retryBlock}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.9,
        messages: [
          { role: "system", content: "You write concise, original story titles. Return plain text only." },
          { role: "user", content: prompt },
        ],
      });

      const candidate = response.choices[0]?.message?.content?.trim() ?? "";
      if (!candidate) continue;

      const cleaned = candidate.replace(/^["'“”]+|["'“”]+$/g, "").trim();
      if (!cleaned) continue;
      if (!tooSimilarToExisting(cleaned, existingTitles)) {
        return NextResponse.json({ result: cleaned }, { headers: corsHeaders });
      }

      feedback = cleaned;
    }

    return NextResponse.json(
      { error: "Could not generate a sufficiently distinct title." },
      { status: 422, headers: corsHeaders }
    );
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
