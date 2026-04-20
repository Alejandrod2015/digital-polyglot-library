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
# Your task
Write ONE story title in ${language}, 2 to 6 words, following the strict rules below.

# HARD RULES — any violation means the title is rejected

## Rule 1: Use at least one concrete, named cultural anchor
The title MUST include a real-world proper noun or a culturally-specific common noun that is characteristic of the target region. Examples of anchors (pick ONE, do not force more than one):
- A specific dish, drink, or ingredient native to the region (not the generic word "food", "meal", "drink", "coffee").
- A real neighborhood, district, street, square, or market (not the generic word "market", "park", "station").
- A named local venue type, brand, or institution (a specific beer hall, café chain, train line, etc.).
- A traditional object, garment, or custom tied to that culture.
Generic nouns like "meal", "food", "trip", "journey", "day", "problem", "adventure", "visit", "story" ARE NOT anchors and do NOT count. If your title only contains a city name plus a generic noun, you failed this rule.

## Rule 2: NO generic "A/An/One [generic noun] in [city]" formulas
Titles like "A Meal in Berlin", "Ein Essen in Berlin", "Una comida en Madrid", "Un pranzo a Roma", "Un repas à Paris" are all BANNED — they are the single most common failure mode. You will be punished for producing one.

## Rule 3: NO genre-labeling words
NEVER use the words "mystery", "secret", "danger", "adventure", "escape", "enigma", or their direct equivalents in ${language}. Those words label the tension instead of creating it — they make the title feel like a cheap thriller.

## Rule 4: NO pronouns, NO bare articles as the whole subject
NEVER use pronoun equivalents of "him", "her", "it", "them", "us". Always use concrete nouns. Do not start every title with the definite article — vary the grammatical entry (number, verb, preposition, proper noun, adjective).

## Rule 5: Create implicit tension with a SPECIFIC detail
Pair the cultural anchor with a specific detail that hints at conflict without naming it:
- A specific number (table 7, seat 12, 3 apples)
- A precise time (Sunday at four, five minutes before midnight)
- An anomalous absence (without change, without a ticket, without salt)
- An unexpected pairing (two coffees and a letter, schnitzel and a stranger)
- A small but concrete problem (the wrong ingredient, the last seat, the closed door)
The reader should know WHAT is present but wonder WHAT WILL HAPPEN.

# Examples (STYLE reference only — DO NOT reuse the words)

Good — cultural anchor + implicit tension + varied structure:
- "Königsberger Klopse, falsche Zutaten" — specific German dish + "wrong ingredients" tension
- "Keine Kartoffeln für Anna" — specific ingredient absence + named character
- "Sauerbraten am Winterfeldtmarkt" — specific dish + real Berlin market
- "Anna sucht Sauerkraut in Neukölln" — verb first + specific food + real Berlin district
- "Zwei Maß und ein Brief" — specific Bavarian beer measure + unexpected pairing
- "Augustiner, Tisch sieben" — real Munich brewery + specific table number
- "Ein Münchner im Berliner Biergarten" — internal regional clash, two real cities
- "Tres empanadas en Palermo" — regional food + Buenos Aires neighborhood
- "La Boca, domingo a las cuatro" — barrio + specific day and hour
- "Choripán sin chimichurri" — specific street food + absence of key ingredient
- "Un Napolitano a Milano" — internal Italian clash, real cities
- "Bar Trieste, tavolo otto" — venue + specific table number
- "Tre cannoli per Rosa" — regional pastry + named person
- "Croque-monsieur à Belleville" — specific dish + real Paris neighborhood
- "Deux pains et un billet" — specific pairing, no genre label

BAD — the model must NEVER produce anything resembling these:
- "Ein Essen in Berlin" — generic noun + city, no anchor, banned formula
- "Eine Reise nach München" — "a trip to X" formula, no anchor
- "Die Reise von Clara und Paul" — generic journey formula
- "Der Fremde im Biergarten" — vague stock character
- "Das Geheimnis im Zug" — genre label ("secret"), cheap thriller feel
- "Wien um Mitternacht" — too vague, no situation
- "Airport Adventure" — generic, genre label
- "Salzburg erkennt ihn" — pronoun, reads like a phrase not a title
- "Una comida en Madrid" — banned "a meal in city" formula
- "Un viaggio a Roma" — banned "a trip to city" formula

# Context for this title

- Target language: ${language}
${region ? `- Region / cultural context: ${region}. Your cultural anchor MUST come from this region specifically, not a generic national stereotype.` : ""}
${topic ? `- Story topic: "${topic}"` : ""}
${synopsis ? `- Synopsis to draw details from: "${synopsis}"` : ""}

IMPORTANT: Mine the synopsis (if provided) for concrete nouns — specific dishes, neighborhoods, objects, characters, times — and build the title from those. If the synopsis mentions "traditional German dishes", DO NOT write "a meal" — pick a specific German dish (Sauerbraten, Königsberger Klopse, Rouladen, Schnitzel) and put THAT in the title.

# Output
Return ONLY the title text in ${language}. No quotes, no explanation, no prefix, no trailing punctuation beyond what the title naturally requires.
${retryBlock}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.9,
        messages: [
          { role: "system", content: "You write concise, original story titles with concrete cultural anchors. You follow hard rules strictly and never produce banned formulas. Return plain text only." },
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
