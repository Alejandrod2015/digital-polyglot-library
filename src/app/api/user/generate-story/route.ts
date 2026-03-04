import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { PrismaClient } from "@/generated/prisma";
import slugify from "slugify";
import { customAlphabet } from "nanoid";
import { generateAndUploadCover } from "@/lib/dalle";
import { inferTopicFromText } from "@/lib/topicClassifier";
import { improveVocabDefinitions } from "@/lib/vocabQuality";

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

type StoryJSON = {
  title: string;
  text: string;
  vocab: { word: string; definition: string; type?: string }[];
};

function isValidStoryJSON(data: unknown): data is StoryJSON {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as StoryJSON).title === "string" &&
    typeof (data as StoryJSON).text === "string" &&
    Array.isArray((data as StoryJSON).vocab)
  );
}

// 🔹 Normaliza el HTML para mantener formato igual al de Sanity
function normalizeStoryHtml(html: string): string {
  // Envuelve cada bloque <blockquote> en <p> si no lo tiene
  const withParagraphs = html.replace(
    /<blockquote>([\s\S]*?)<\/blockquote>/gi,
    (_m, inner: string) => {
      const hasP = /<\s*p\b/i.test(inner);
      const wrapped = hasP ? inner : `<p>${inner.trim()}</p>`;
      return `<blockquote>${wrapped}</blockquote>`;
    }
  );

  // Si no hay blockquotes, garantiza que los párrafos estén dentro de <p>
  if (!withParagraphs.includes("<p>")) {
    const chunks = withParagraphs
      .split(/\n{2,}/)
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => `<p>${c}</p>`);
    return chunks.join("");
  }

  return withParagraphs;
}

export async function POST(req: Request) {
  try {
    const { userId } = (await auth()) ?? { userId: null };
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const plan = (user?.publicMetadata?.plan as string) ?? "free";
    if (plan !== "polyglot") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      language?: string;
      region?: string;
      level?: string;
      focus?: string;
      topic?: string;
      customTopic?: string;
    };

    const {
      language = "Spanish",
      region,
      level = "intermediate",
      focus = "verbs",
      topic = "",
      customTopic = "",
    } = body;
    const requestedTopic = typeof topic === "string" ? topic.trim() : "";
    const customTopicResolved =
      typeof customTopic === "string" ? customTopic.trim().slice(0, 120) : "";
    const resolvedTopic = customTopicResolved || requestedTopic;

    const regionClause = region ? `, specifically from ${region}` : "";

    const prompt = `
You are an expert fiction writer and language teacher.
Write a vivid, modern story in ${language}${regionClause} for a ${level} student.
${resolvedTopic ? `The topic is "${resolvedTopic}".` : "Choose a concrete, modern topic that fits the level."}
All vocabulary definitions must be written in clear English, regardless of the story language.
Each vocabulary definition must be a pedagogical explanation (8-18 words), with usage nuance in context.
Never return one-word literal translations.
Wrap each paragraph inside <blockquote> ... </blockquote>.

Requirements:
Use close third-person narration with natural internal perspective and sharp scene dynamics.

Words to wrap:
- Wrap around 25-30 different items that naturally fit in the story, marking only the first occurrence of each with
<span class='vocab-word' data-word='original-word'>original-word</span>.
- The amount of items you wrap should be the same as the amount of items in the vocab list.
- Prioritize ${focus.toLowerCase()} when choosing words and expressions to wrap.

Narrative quality rules:
- Avoid childish/fable tone. Do NOT start with "Once upon a time", "Érase una vez", or equivalents.
- Avoid generic moral-of-the-story endings.
- Open with immediate action or tension in the first 2-3 lines.
- Include realistic dialogue and specific details (places, constraints, consequences).
- Keep the story for adult learners: natural, grounded, and emotionally believable.
- Keep title short and specific (max 7 words), avoid clichés like "The Mystery of..." unless truly justified.

Return ONLY valid JSON:
{
  "title": "string",
  "text": "string",
  "vocab": [{ "word": "string", "definition": "string" }]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content:
            "You are a high-quality fiction writer for language learners. Avoid repetitive, childish, and formulaic storytelling.",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ error: "No content returned from OpenAI" }, { status: 502 });
    }

    // Parse response JSON safely
    let parsed: unknown;
    try {
      const maybeJSON = JSON.parse(content);
      parsed = typeof maybeJSON === "string" ? JSON.parse(maybeJSON) : maybeJSON;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON returned from model", raw: content },
        { status: 500 }
      );
    }

    if (!isValidStoryJSON(parsed)) {
      return NextResponse.json(
        { error: "Invalid structure in model output", raw: parsed },
        { status: 500 }
      );
    }

    const { title, text, vocab } = parsed as StoryJSON;

    // 🔹 Normalizar texto HTML para formato consistente
    const normalizedText = normalizeStoryHtml(text);
    const improvedVocab = await improveVocabDefinitions(openai, {
      items: vocab,
      language,
      level,
      focus,
      topic: resolvedTopic,
      text: normalizedText,
    });

    // Normalizar nivel
    const normalizedLevel = (() => {
      const l = (level || "").toLowerCase();
      if (l === "basic" || l === "elementary") return "Beginner";
      if (l === "intermediate") return "Intermediate";
      if (l === "advanced") return "Advanced";
      return "Beginner";
    })();

    // Generar slug único
    const baseSlug = slugify(title, { lower: true, strict: true }).slice(0, 80);
    const uniqueSlug = `${baseSlug}-${nanoid()}`;

    const inferredTopic = inferTopicFromText({
      title,
      text: normalizedText,
      existingTopic: resolvedTopic,
      fallback: "Daily life",
    });

    const savedStory = await prisma.userStory.create({
      data: {
        userId,
        title,
        slug: uniqueSlug,
        text: normalizedText,
        vocab: improvedVocab,
        language,
        region,
        level: normalizedLevel,
        focus,
        topic: inferredTopic,
        public: true,
      },
    });

    // 🔹 Generación de portada (DALL·E) en segundo plano
    try {
  const cover = await generateAndUploadCover({
    title,
    language,
    region,
    topic: inferredTopic,
    level: normalizedLevel,
    text: normalizedText,
  });

  if (cover && cover.url && cover.filename) {
    await prisma.userStory.update({
      where: { id: savedStory.id },
      data: {
        coverUrl: cover.url,
        coverFilename: cover.filename,
      },
    });
  }
} catch (e: unknown) {
  console.error("[cover] Failed to generate/upload cover:", e);
}

    // 🔹 Generación de audio en segundo plano
    try {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      fetch(`${appUrl}/api/audio/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: savedStory.id,
          text: normalizedText,
          title,
          language,
          region,
        }),
      }).catch((err) => console.error("[background audio job failed]", err));
    } catch (err) {
      console.error("[background job launch failed]", err);
    }

    return NextResponse.json({
      message: "Story generated successfully",
      story: {
        id: savedStory.id,
        slug: savedStory.slug,
        title: savedStory.title,
        text: savedStory.text,
        vocab: savedStory.vocab,
        language: savedStory.language,
        region: savedStory.region,
        level: savedStory.level,
        focus: savedStory.focus,
        topic: savedStory.topic,
      },
    });
  } catch (error: unknown) {
    console.error("💥 ERROR in /api/user/generate-story");
    console.error("Full error object:", JSON.stringify(error, null, 2));
    const maybe = error as {
      code?: string;
      type?: string;
      status?: number;
      message?: string;
      error?: { code?: string; message?: string; type?: string };
    };
    const code = maybe?.code ?? maybe?.error?.code;
    const type = maybe?.type ?? maybe?.error?.type;

    if (code === "insufficient_quota" || type === "insufficient_quota") {
      return NextResponse.json(
        {
          error: "Story generation is temporarily unavailable. Please try again shortly.",
        },
        { status: 429 }
      );
    }

    if (maybe?.status === 429) {
      return NextResponse.json(
        {
          error: "Story generation is temporarily unavailable. Please try again shortly.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate story", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
