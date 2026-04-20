import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildSanityCorsHeaders } from "@/lib/sanityCors";
import { cefrPromptLabel } from "@domain/cefr";
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
# Your task
Write one concise synopsis in ${language} for a story titled "${title}".

# HARD RULES — any violation makes the synopsis unusable

## Rule 1: The title's anchor defines the setting — do not mix incompatible places
The title contains a concrete anchor (a dish, a neighborhood, a market, a venue, an object). The synopsis MUST take place IN or AROUND that anchor. Do NOT invent a second incompatible location just to fit the story topic.

Examples of INCOMPATIBLE mixes the model often makes (all BANNED):
- Title anchor is a neighborhood (Kreuzberg, Palermo, Trastevere) but the synopsis has the character "waiting for a flight" in that neighborhood. Neighborhoods are NOT airports. A character can LIVE in a neighborhood, WALK through it, EAT there, but cannot wait for a flight there.
- Title anchor is a food market (Markthalle Neun, Mercado de San Miguel) but the synopsis mentions airports, train stations, or offices inside the market. Markets are markets.
- Title anchor is a café or bar but the synopsis moves to a completely unrelated venue halfway through.

If the topic ("${topic || "(none)"}") seems to force an incompatible place (e.g., topic is "Airport & Transit" but the title anchor is a neighborhood): resolve the tension by REINTERPRETING the topic to fit the anchor. "Airport & Transit" in a Kreuzberg setting becomes "packing, commuting to BER from Kreuzberg, or saying goodbye in a Kreuzberg café" — NOT "waiting for a flight in Kreuzberg".

## Rule 2: Respect the real-world function of named places
If the title or synopsis mentions a REAL named place, stay faithful to what that place actually is:
- Markthalle Neun (Berlin): a covered food market famous for Street Food Thursday, artisanal vendors, and regional/international street food — NOT a Döner-Imbiss counter. Don't claim it sells things it doesn't sell.
- A specific real café, bar, brewery, or neighborhood should behave like itself — a beer hall serves beer, not tacos; a Wiener Beisl serves Viennese food, not sushi.
- If you are not sure what a real place actually sells or hosts, describe it in generic terms rather than fabricating details.

## Rule 3: Plausible character behavior in the cultural setting
Characters must behave in ways that make sense for the setting:
- A vendor in a multicultural urban district (Kreuzberg, Neukölln, Belleville, Lavapiés) will understand basic orders in the local language. "The vendor does not understand 'without onions'" is NOT plausible.
- Don't invent communication breakdowns that wouldn't happen. Use real cultural friction instead (the queue is long, the kitchen is slow, the character hesitates about dialect).

## Rule 4: Correct grammar for the target language
- Use the correct gender and preposition for named places. E.g., in German: "in der Markthalle Neun" (feminine), not "auf dem Markthalle Neun"; "auf dem Winterfeldtmarkt" (masculine) is fine. Verify the gender before committing.
- Use the correct article for compound nouns and real proper nouns.

## Rule 5: Sober, concrete style — no forced metaphors or marketing copy
- No sentimental or cringe-worthy lines like "the Döner became her faithful companion", "the coffee was her only friend", "the city whispered its secrets".
- No marketing tone ("a tale of discovery...", "an unforgettable journey...").
- No mention of "the reader", "language learners", or the fact that this is a story.
- Prefer concrete actions and sensory details over abstract themes.

## Rule 6: Coherence of action and time
- The characters are in ONE clearly-described place. If they move, describe the move concretely.
- Don't use "Anschlussflug" / "connecting flight" / equivalents unless the earlier sentences establish they are already in transit.
- The conflict must emerge from the specific situation, not from a generic "time is running out" cliché dropped in.

# Output shape
- 2 to 4 sentences, 45 to 90 words total, in ${language}.
- Mention the main character(s) by a simple name or role.
- State the central situation or small concrete conflict clearly.
- Include enough concrete detail (what dish, which neighborhood, what time of day, what object) to guide later story and cover generation.
- Return ONLY the synopsis text — no quotes, no headings, no bullet points, no marketing framing.

# Context
- Title: "${title}"
- Language: ${language}
${regionClause ? `- ${regionClause.trim()}` : ""}
${topicClause ? `- ${topicClause.trim()} (remember: if the topic clashes with the title anchor, REINTERPRET the topic to fit the anchor)` : ""}
${variantClause ? `- ${variantClause.trim()}` : ""}
- Learning focus: "${focus}"
- Learner level: ${learnerProfile}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      messages: [
        { role: "system", content: "You write concise, plausible story synopses. You respect the real-world function of named places, keep the action inside the title's anchor, use correct grammar, and never write cringe metaphors or marketing copy. Return plain text only." },
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
