/**
 * Regenerate covers for the 5 published stories in the first 3 topics of the
 * German Conversacional journey using HAND-WRITTEN English scene descriptions
 * per story. The buildCoverPrompt helper proved too generic for these
 * scenes; here we treat each story like the validated Beim Bäcker test.
 *
 * Style stays identical to the cool-cartoon spec: Storyset/Freepik aesthetic,
 * cool sage/lavender/dusty blue palette at vivid (intensity-A) saturation,
 * mid-shot characters as the focal point.
 *
 * Run: pnpm dlx tsx scripts/regenerateGermanFirstThreeTopicCoversManual.ts
 */

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { sanitizeFileChunk } from "../src/lib/coverGenerator";

config({ path: ".env.local" });
config({ path: ".env" });

const GEMINI_MODEL = "gemini-3-pro-image-preview";

const SHARED_STYLE = [
  "Modern flat cartoon character illustration in the Storyset / Freepik educational-app aesthetic.",
  "Stylized rounded faces with large expressive almond-shaped eyes,",
  "soft gradient skin shading, simplified cel-shaded clothing, smooth clean linework, friendly approachable expressions.",
  "Same family of illustrations used by Duolingo, Notion, Headspace and Babbel landing pages.",
].join(" ");

const PALETTE = [
  "Color tonality: cool harmony anchored on sage green, lavender and dusty blue,",
  "with vivid confident saturation, not pastel and not washed-out.",
  "Use as many colors as the scene needs across props, clothing and environment.",
].join(" ");

const COMPOSITION = [
  "The human characters are the focal point of the image, not the building or the props.",
  "Mid-shot framing, faces clearly visible.",
  "Wide horizontal 16:9 landscape frame.",
  "No text, no letters, no captions, no logos, no borders.",
].join(" ");

type StoryPlan = {
  slug: string;
  topic: string;
  slotIndex: number;
  scene: string;
};

// Hand-written scene per story. The model receives the scene as a literal
// description, not a stripped-down German excerpt.
const PLANS: StoryPlan[] = [
  {
    slug: "beim-baecker-am-hackeschen-markt",
    topic: "food-everyday-life",
    slotIndex: 0,
    scene: [
      "Interior of a small German bakery on a Saturday morning at Hackescher Markt in Berlin.",
      "Two women are the unmistakable main subject of the composition, framed in a mid-shot from the chest up:",
      "a middle-aged female customer in a simple coat stands in front of a wooden counter,",
      "and a young female baker in a clean apron stands behind it, smiling and handing her a paper bag with a half loaf of rye bread and small bread rolls.",
      "Behind the baker, wooden shelves hold loaves of crusty bread and rows of small bread rolls.",
      "Soft morning light comes from a large storefront window on the side.",
    ].join(" "),
  },
  {
    slug: "tomaten-vom-wochenmarkt",
    topic: "food-everyday-life",
    slotIndex: 1,
    scene: [
      "Open-air weekly farmers market on a sunny Saturday morning at Boxhagener Platz in Berlin-Friedrichshain.",
      "Two people are the unmistakable main subject of the composition, framed in a mid-shot from the chest up:",
      "a young female shopper with a tote bag stands in front of a vegetable stall,",
      "and a friendly middle-aged male vegetable vendor in a green apron stands behind it, holding ripe red tomatoes in his hands and offering them to her.",
      "On the stall counter: wooden crates full of red ripe tomatoes, fresh basil bunches, and a small chalkboard for prices.",
      "Behind the vendor, a market awning and a few other stalls are softly suggested.",
    ].join(" "),
  },
  {
    slug: "eiscafe-am-sommerabend",
    topic: "food-everyday-life",
    slotIndex: 2,
    scene: [
      "Interior of a small ice cream parlor in Berlin on a warm summer evening, golden-hour light coming through the window.",
      "Two women are the unmistakable main subject of the composition, framed in a mid-shot from the chest up:",
      "a young female customer stands in front of a glass gelato display case looking at the flavors,",
      "and a young female server in an apron stands behind it, smiling and pointing at one of the gelato tubs with a small ice cream scoop in her hand.",
      "The glass case shows several colorful gelato tubs in pastel and bright colors.",
      "A second customer, a young man, waits politely a step behind, holding a wallet.",
    ].join(" "),
  },
  {
    slug: "sonntag-in-prenzlauer-berg",
    topic: "home-family",
    slotIndex: 0,
    scene: [
      "A cozy Berlin apartment kitchen-dining area in Prenzlauer Berg on a calm Sunday morning.",
      "Three people, a small family, are the unmistakable main subject of the composition, framed in a mid-shot from the chest up around a wooden breakfast table:",
      "a mother in a simple sweater pours coffee from a French press into a mug,",
      "a father holds an open newspaper and smiles,",
      "and a young son talks while reaching for a bread roll.",
      "On the table: a basket of fresh bread rolls, butter, jam, two coffee mugs, and a glass of orange juice.",
      "A large window in the background suggests a Berlin Altbau apartment with tall ceilings.",
    ].join(" "),
  },
  {
    slug: "cafe-in-kreuzberg",
    topic: "meeting-new-people",
    slotIndex: 0,
    scene: [
      "Interior of a small cozy café in Kreuzberg, Berlin, in the afternoon.",
      "Two people are the unmistakable main subject of the composition, framed in a mid-shot from the chest up at a small round wooden table by the window:",
      "a young woman with a relaxed expression sits on one side, an open book in front of her and a coffee cup beside it,",
      "and a friendly man, slightly older, has just sat down opposite her, smiling politely as if asking permission to share the table.",
      "Through the window behind them, a softly suggested Kreuzberg streetscape with brick facade and a tree.",
      "On the table: two coffee cups, the open book, a small plant in a pot.",
    ].join(" "),
  },
];

function buildPromptForPlan(plan: StoryPlan): string {
  return [plan.scene, SHARED_STYLE, PALETTE, COMPOSITION].join(" ");
}

async function generateCoverBuffer(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: "Generate a horizontal 16:9 landscape cover illustration. " + prompt }] }],
    generationConfig: { responseModalities: ["IMAGE"] },
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini ${GEMINI_MODEL} rejected (${response.status}): ${details.slice(0, 400)}`);
  }
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
    promptFeedback?: { blockReason?: string };
  };
  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Gemini ${GEMINI_MODEL} blocked: ${payload.promptFeedback.blockReason}`);
  }
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inline = part.inlineData;
      if (inline?.data) return Buffer.from(inline.data, "base64");
    }
  }
  throw new Error(`Gemini ${GEMINI_MODEL} returned no inline image data.`);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const journey = await prisma.journey.findFirst({
    where: {
      language: { equals: "german", mode: "insensitive" },
      name: { equals: "Conversacional", mode: "insensitive" },
    },
  });
  if (!journey) throw new Error("German Conversacional journey not found");

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: journey.id, status: "published", topic: { in: PLANS.map((p) => p.topic) } },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { id: true, title: true, slug: true, topic: true, slotIndex: true },
  });

  for (const plan of PLANS) {
    const story = stories.find((s) => s.slug === plan.slug || (s.topic === plan.topic && s.slotIndex === plan.slotIndex));
    if (!story) {
      console.warn(`[skip] no story matched plan ${plan.slug}`);
      continue;
    }
    const prompt = buildPromptForPlan(plan);
    const fileBase = sanitizeFileChunk(story.title || plan.slug);
    const filename = `${fileBase}-cool-cartoon-manual-${Date.now()}.png`;
    const tag = `${story.topic}/slot${story.slotIndex}`;
    try {
      console.log(`[start] ${tag} — ${story.title}`);
      const buffer = await generateCoverBuffer(prompt);
      const uploaded = await uploadPublicObject({
        key: `media/generated/images/${filename}`,
        body: buffer,
        contentType: "image/png",
      });
      if (!uploaded?.url) throw new Error("upload returned no url");
      await prisma.journeyStory.update({
        where: { id: story.id },
        data: { coverUrl: uploaded.url, coverDone: true },
        select: { id: true },
      });
      console.log(`[ok] ${tag} -> ${uploaded.url}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[fail] ${tag}: ${message}`);
    }
  }

  await prisma.$disconnect();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
