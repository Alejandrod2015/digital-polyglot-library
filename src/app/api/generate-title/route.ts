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
  /**
   * Caller-supplied "do not reuse" list. Studio's V1/V2 generators
   * compute the in-progress titles for the same journey from the
   * Prisma `JourneyStory` table and pass them in here. Without this,
   * the title endpoint only sees Sanity's catalog and keeps picking
   * the canonical anchor for the region/topic (e.g. "Cacio e Pepe a
   * Trastevere") every time within the same journey.
   */
  extraExistingTitles?: string[];
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
    // 0.5 instead of 0.8 — half-overlap on a short title almost
    // always means the same cultural anchor is being reused (e.g.
    // "Quartieri Spagnoli, pizza margherita" vs "Arancini a
    // Quartieri Spagnoli" share 50% of tokens). Reject those.
    return denominator > 0 && overlap / denominator >= 0.5;
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
    const extraExistingTitles = Array.isArray(body.extraExistingTitles)
      ? body.extraExistingTitles.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : [];

    const sanityTitles = await getExistingGeneratedTitles(documentId || undefined);
    // Merge caller-supplied + Sanity titles. Caller titles come first so
    // the retry block surfaces them earlier when feedback is constructed.
    const existingTitles = [...extraExistingTitles, ...sanityTitles];
    let feedback = "";

    // Always-on existing titles block — shown even on the first
    // attempt so the model isn't blind to titles already used in
    // the catalog. Earlier this only appeared in retry blocks,
    // which let the first attempt happily pick "Quartieri Spagnoli"
    // again after another story already used it; the subsequent
    // similarity check used an 80% token-overlap threshold that
    // didn't catch shared two-word anchors when the rest differed.
    const existingTitlesBlock = existingTitles.length
      ? `\n\n# Titles already used — do NOT repeat their cultural anchor\nThe titles below already exist. Pick a fresh anchor (a different neighborhood, dish, venue, named object) characteristic of the same region but not appearing in this list:\n${existingTitles.slice(0, 80).join(" | ")}`
      : "";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const retryBlock =
        attempt === 0
          ? ""
          : `\nPrevious attempt failed uniqueness: ${feedback}. Rotate the anchor — pick a different neighborhood, dish, venue, or named object than what you tried before AND than anything in the list above.`;

      const prompt = `
# Your task
Write ONE story title in ${language}, 2 to 6 words.

# The one thing that matters: a concrete cultural anchor
The title must include at least ONE real-world proper noun or a culturally-specific common noun characteristic of the target region — a specific dish, a real neighborhood, a named venue, a traditional object. Not a generic noun like "meal", "food", "trip", "journey", "day", "adventure", "visit".

That is the only hard requirement. Everything else below is advice on taste, not additional checkboxes.

# Keep it simple. Do NOT over-engineer.
Think of real book titles. "Mrs. Dalloway". "Der Prozess". "El Aleph". They are concrete names, not packed sentences. Most good titles contain ONE cultural element and nothing else. A second element (a small number, a name, an absence, a time) is OPTIONAL — include it only when the synopsis makes it feel natural, never to satisfy a checklist.

## The single most common failure to avoid: stacking layers
If your title combines three or more of these into one title, you have over-engineered it:
- a specific dish
- a specific ingredient or accessory (especially framed as an absence)
- a specific location / venue
- a specific number or time

Concrete example of over-engineering to AVOID: "Kartoffelsalat ohne Senf am Flughafen" — a dish + an ingredient absence + a location is too many anchors. The result reads like the model was checking boxes.

When tempted to add a second or third detail: delete elements instead of adding them, until the title feels like a natural name, not a description.

# Graded examples — note the default is simple

## Level 1 (default — single anchor, nothing else, use this most of the time):
- "Sauerbraten am Winterfeldtmarkt"
- "Tres empanadas en Palermo"
- "Augustiner, Tisch sieben"
- "Bar Trieste, tavolo otto"
- "Croque-monsieur à Belleville"
- "Ein Münchner im Berliner Biergarten"

## Level 2 (anchor + one natural extra — only when the synopsis explicitly motivates it):
- "Keine Kartoffeln für Anna" — a named character AND a simple absence
- "Tre cannoli per Rosa" — a regional pastry AND a named character
- "La Boca, domingo a las cuatro" — a neighborhood AND a specific time

## Level 3 (rare — only when the absence is culturally essential to the dish):
- "Choripán sin chimichurri" — chimichurri is structurally essential to a choripán, so its absence is meaningful

Default to Level 1. Go to Level 2 only if Level 1 feels too bare for this particular synopsis. Go to Level 3 almost never.

# Banned patterns (hard rejects)
- "A/An [generic noun] in [city]": "Ein Essen in Berlin", "Una comida en Madrid", "Un viaggio a Roma", "A Meal in Paris"
- Three or more stacked anchors: "Kartoffelsalat ohne Senf am Flughafen", "Schnitzel mit Salat in München"
- Genre-labeling words: equivalents of "mystery", "secret", "danger", "adventure", "escape", "enigma" in ${language}
- Pronouns: no equivalents of "him", "her", "it", "them"
- Generic formulas: "A Day in...", "The Story of X and Y", "The Journey of...", "A Problem with..."

# Context for this title
- Target language: ${language}
${region ? `- Region / cultural context: ${region}` : ""}
${topic ? `- Story topic: "${topic}"` : ""}
${synopsis ? `- Synopsis: "${synopsis}" — mine it for ONE concrete noun (a dish, neighborhood, object, venue, character name) and build the title around that noun. Do not try to reflect every detail of the synopsis.` : ""}
${existingTitlesBlock}

# Output
Return ONLY the title text in ${language}. No quotes, no explanation.
${retryBlock}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.7,
        messages: [
          { role: "system", content: "You write concise, restrained story titles anchored in one cultural element. You prefer simple titles to elaborate ones, and you never stack multiple anchors. Return plain text only." },
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
