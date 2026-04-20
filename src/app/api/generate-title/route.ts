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
You create strong, culturally-grounded story titles for a language-learning app.

Write ONE title in ${language}.
${region ? `The title MUST feel rooted in ${region} — use real place names, neighborhoods, local brands, regional foods/drinks, traditional objects, or culturally-specific venues that could only belong to that culture.` : ""}
${topic ? `The story topic is "${topic}".` : ""}
${synopsis ? `Use this synopsis to infer characters, conflict, and setting: "${synopsis}".` : ""}

# What makes a good title

A real title is concise, memorable, and evocative — not a scene description, not a plot explanation. Think of it like the title printed on a book cover.

## 1. Cultural specificity (REQUIRED)
The title must feel like the story could ONLY happen in that culture. Generic situations (an airport, a train, a café, a park) are universal — NOT acceptable alone.
- Use concrete cultural markers: real neighborhood names, regional foods/drinks, local brand or venue names, traditional objects, typical social settings.
- Avoid the most touristy clichés (the single most famous monument or festival named directly). Go one level deeper — the everyday cultural texture, not the postcard.
- Internal regional contrasts (someone from region A in region B within the same country) are often strong.

## 2. Narrative tension (IMPLICIT, never labeled)
The title should suggest a situation, not just a place.
- NEVER use words that name the genre: equivalents of "mystery", "secret", "danger", "adventure", "escape", "enigma" in ${language}. Labeling the tension makes the title feel like a cheap thriller.
- Create intrigue through specific details: unusual pairings, specific numbers, anomalous objects, precise times, unexpected juxtapositions.
- Balance: specific in the situation (reader knows WHAT is present), mysterious in the consequences (reader wonders WHAT WILL HAPPEN).

## 3. Language and density
- 2 to 6 words.
- Do NOT use pronouns — no equivalents of "him", "her", "it", "them" — always use concrete nouns.
- Avoid extremely long compound words that intimidate learners, but don't oversimplify either. Aim for accessible but textured vocabulary.
- Do NOT use generic formulas: "A Day in...", "The Story of...", "The Journey of X and Y", "A Problem with...", "Important Decision".

## 4. Structural variety
Do NOT always begin with a definite article (the equivalents of "The/Die/Der/Das/Le/La/El"). Vary the grammatical entry point across different title attempts:
- Number first: "Two espressos and a letter"
- Verb first: "Stolen at the pier"
- Preposition first: "Inside the last tram"
- Proper noun first: "Trieste, Saturday night"
- Adjective first, conjunction first, etc.

# Examples (illustrative of STYLE only — do NOT reuse content)

Good (specific culture + implicit tension + varied structure):
- "Ein Münchner im Berliner Biergarten" (internal regional clash, real cities)
- "Augustiner, Tisch sieben" (real Munich brewery + specific table number)
- "Zwei Maß und ein Brief" (culturally-specific object + unexpected pairing)
- "Tres empanadas en Palermo" (regional food + Buenos Aires neighborhood)
- "La Boca, domingo a las cuatro" (barrio + specific day and hour)
- "Un Napolitano a Milano" (internal cultural clash, real cities)
- "Bar Trieste, tavolo otto" (venue + specific table number)
- "Due caffè al Procope" (culinary detail + real Parisian historic café)

Bad (reject these patterns):
- "Die Reise von Clara und Paul" — generic, could be any country
- "Der Fremde im Biergarten" — too simple and vague
- "Das Geheimnis im Zug" — names the genre ("secret"), cheap feel
- "Wien um Mitternacht" — too vague, no situation
- "Der Zug um Mitternacht" — no cultural anchor
- "Airport Adventure" — generic, universal situation
- "Salzburg erkennt ihn" — uses a pronoun ("him"), feels like a phrase not a title

# Output
Return ONLY the title text in ${language}. No quotes, no explanation, no trailing punctuation beyond what the title naturally requires.
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
