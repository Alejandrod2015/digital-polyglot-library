import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { generateSlug } from "@/agents/content/tools";
import { generateStoryPayload } from "@/lib/storyGenerator";
import { VARIANT_LABELS, type LanguageVariant } from "@domain/languageVariant";

export const maxDuration = 60;

function getDetailedRegionDescription(variant?: string, language?: string): string {
  if (!variant) return "";
  const normalizedVariant = variant.trim().toLowerCase() as LanguageVariant;

  const regionDetails: Record<string, Record<string, string>> = {
    spanish: {
      latam: "Latin America (Colombia, Mexico, Argentina, Peru, Chile) — use regional foods (empanadas, arepas, tacos al pastor, asado, choripán, ceviche, pisco), neighborhoods (Palermo, Condesa, Miraflores, La Candelaria), and cultural markers",
      spain: "Spain (Madrid, Barcelona, Valencia, Seville) — use regional foods (tortilla de patatas, jamón ibérico, paella, tapas, pulpo a la gallega), neighborhoods (Malasaña, Lavapiés, Gracia, Triana), and cultural markers",
    },
    english: {
      us: "United States (New York, LA, Chicago) — use regional foods and brands, neighborhoods (Williamsburg, Silver Lake, Wicker Park, Mission), and cultural markers",
      uk: "United Kingdom (London, Manchester, Edinburgh) — use regional foods (fish and chips, Sunday roast, Cornish pasty), neighborhoods (Shoreditch, Camden, Peckham), and cultural markers",
    },
    portuguese: {
      brazil: "Brazil (São Paulo, Rio, Salvador) — use regional foods (feijoada, pão de queijo, açaí, moqueca, coxinha), neighborhoods (Ipanema, Pinheiros, Pelourinho, Vila Madalena), and cultural markers",
      portugal: "Portugal (Lisbon, Porto) — use regional foods (bacalhau à brás, pastel de nata, francesinha, bifana), neighborhoods (Alfama, Bairro Alto, Ribeira), and cultural markers",
    },
    german: {
      germany: "Germany (Berlin, Munich, Hamburg) — use regional foods (Sauerbraten, Königsberger Klopse, Currywurst, Bratwurst, Kartoffelsalat, Rouladen, Maultaschen), neighborhoods (Kreuzberg, Schwabing, Neukölln, Prenzlauer Berg), real markets (Winterfeldtmarkt, Markthalle Neun, Viktualienmarkt), and cultural markers",
      austria: "Austria (Vienna, Salzburg) — use regional foods (Wiener Schnitzel, Tafelspitz, Sachertorte, Apfelstrudel, Kaiserschmarrn), neighborhoods (Neubau, Leopoldstadt, Wieden), real coffeehouses (Café Central, Café Sperl, Café Hawelka), and cultural markers",
    },
    french: {
      france: "France (Paris, Lyon, Marseille) — use regional foods (croque-monsieur, bouillabaisse, quenelles, tarte flambée, cassoulet), neighborhoods (Belleville, Le Marais, Croix-Rousse, Le Panier), and cultural markers",
      "canada-fr": "French Canada (Quebec, Montreal) — use regional foods (poutine, tourtière, pâté chinois), neighborhoods (Plateau, Petite-Italie, Vieux-Québec), and cultural markers",
    },
    italian: {
      italy: "Italy (Rome, Milan, Naples, Florence) — use regional foods (cacio e pepe, risotto alla milanese, pizza napoletana, cannoli, arancini, bistecca fiorentina), neighborhoods (Trastevere, Navigli, Quartieri Spagnoli, Oltrarno), and cultural markers",
    },
    korean: {
      "south-korea": "South Korea (Seoul, Busan) — use regional foods (kimchi jjigae, bibimbap, tteokbokki, samgyeopsal, japchae, galbi), neighborhoods (Hongdae, Itaewon, Gangnam, Seongsu), and cultural markers",
    },
  };

  const langDetails = regionDetails[language?.toLowerCase() ?? ""] ?? {};
  return langDetails[normalizedVariant] || VARIANT_LABELS[normalizedVariant] || "";
}

/**
 * POST /api/studio/journeys/generate
 * Body: { storyId } — generates content for a JourneyStory slot
 * Uses the same high-quality Sanity story generator.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, any>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

  // Mark as generating
  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { status: "generated", error: null },
  });

  try {
    // Get existing titles + character names from same topic to avoid repetition
    const existingStories = await prisma.journeyStory.findMany({
      where: { journeyId: story.journeyId, title: { not: null } },
      select: { title: true, text: true, topic: true },
    });
    const existingTitles = existingStories.map((s) => s.title).filter(Boolean) as string[];

    const sameTopicStories = existingStories.filter((s) => s.topic === story.topic && s.text);
    const usedNames = new Set<string>();
    for (const s of sameTopicStories) {
      const matches = (s.text ?? "").match(/\b[A-Z][a-zà-ü]+(?:\s+[A-Z][a-zà-ü]+)?\b/g) ?? [];
      const stop = new Set(["The", "This", "That", "She", "Her", "His", "They", "But", "And", "One", "When", "After", "Before", "Der", "Die", "Das", "Ein", "Eine", "Und", "Sie", "Ich", "Wir"]);
      for (const m of matches) { if (!stop.has(m)) usedNames.add(m); }
    }
    const usedCharacterNames = [...usedNames].slice(0, 30);

    const origin = new URL(request.url).origin;
    const detailedRegion = getDetailedRegionDescription(story.journey.variant, story.journey.language);

    // STEP 1: Generate the title first using the dedicated endpoint (gpt-4o + strict cultural rules)
    const titleRes = await fetch(`${origin}/api/generate-title`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "https://www.sanity.io" },
      body: JSON.stringify({
        language: story.journey.language,
        region: detailedRegion || story.journey.variant,
        topic: story.topic,
      }),
    });
    if (!titleRes.ok) {
      const errText = await titleRes.text();
      throw new Error(`generate-title failed: ${titleRes.status} ${errText.slice(0, 200)}`);
    }
    const titleData = await titleRes.json();
    const title = typeof titleData.result === "string" ? titleData.result.trim() : "";
    if (!title) throw new Error("generate-title returned empty title");

    // STEP 2: Generate synopsis using the title (so it's coherent with the specific cultural anchor)
    let synopsis = "";
    try {
      const synopsisRes = await fetch(`${origin}/api/generate-synopsis`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Origin": "https://www.sanity.io" },
        body: JSON.stringify({
          title,
          language: story.journey.language,
          variant: story.journey.variant,
          region: detailedRegion || story.journey.variant,
          cefrLevel: story.level,
          topic: story.topic,
        }),
      });
      if (synopsisRes.ok) {
        const data = await synopsisRes.json();
        synopsis = data.result?.trim() ?? "";
      }
    } catch (e) {
      console.warn("[generate] synopsis generation failed:", e);
    }

    // STEP 3: Generate text + vocab, passing the fixed title and synopsis
    const payload = await generateStoryPayload({
      language: story.journey.language,
      variant: story.journey.variant,
      region: detailedRegion,
      cefrLevel: story.level,
      topic: story.topic,
      focus: "verbs",
      title,
      synopsis,
      existingTitles,
      usedCharacterNames,
    });

    if (!payload) {
      throw new Error("Story generation failed after multiple attempts");
    }

    const baseSlug = generateSlug(payload.title, story.journey.language, story.journey.variant, 0).replace(/-0$/, "");
    const slug = story.slotIndex > 0 ? `${baseSlug}-${story.slotIndex + 1}` : baseSlug;
    const wordCount = payload.text.split(/\s+/).filter(Boolean).length;

    const updated = await prisma.journeyStory.update({
      where: { id: storyId },
      data: {
        status: "generated",
        title: payload.title,
        slug,
        text: payload.text,
        synopsis,
        vocab: payload.vocab as any,
        wordCount,
        vocabCount: payload.vocab.length,
        error: null,
      },
    });

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      slug: updated.slug,
      synopsis: updated.synopsis,
      wordCount: updated.wordCount,
      vocabCount: updated.vocabCount,
      status: updated.status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.journeyStory.update({
      where: { id: storyId },
      data: { status: "draft", error: msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
