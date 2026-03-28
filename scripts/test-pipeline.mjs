/**
 * Test script: runs the pipeline for Italian, 1 story.
 * Uses direct Prisma + OpenAI calls, no Next.js auth needed.
 */
import { PrismaClient } from "../src/generated/prisma/index.js";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
function loadEnv() {
  const files = [".env", ".env.local"];
  for (const f of files) {
    try {
      const content = readFileSync(resolve(process.cwd(), f), "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    } catch {}
  }
}
loadEnv();

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function step(name, fn) {
  console.log(`\n${"─".repeat(50)}`);
  console.log(`▶ ${name}`);
  console.log(`${"─".repeat(50)}`);
  try {
    const result = await fn();
    console.log(`✅ ${name} — OK`);
    return result;
  } catch (e) {
    console.error(`❌ ${name} — FAILED`);
    console.error(`   ${e.message}`);
    if (e.stack) console.error(`   ${e.stack.split("\n").slice(1, 3).join("\n   ")}`);
    return null;
  }
}

async function main() {
  // Step 0: DB check
  await step("Database connection", async () => {
    const draftCount = await prisma.storyDraft.count();
    console.log(`   ${draftCount} existing drafts`);
    const briefCount = await prisma.curriculumBrief.count();
    console.log(`   ${briefCount} existing briefs`);
    return true;
  });

  // Step 1: Create a test brief for Italian manually
  const brief = await step("Create Italian brief", async () => {
    const existing = await prisma.curriculumBrief.findFirst({
      where: { language: "italian", status: "draft" },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      console.log(`   Using existing brief: ${existing.id} (topic: ${existing.topicSlug})`);
      return existing;
    }

    const created = await prisma.curriculumBrief.create({
      data: {
        language: "italian",
        variant: "italy",
        level: "a1",
        topicSlug: "greetings-and-introductions",
        journeyFocus: "General",
        storySlot: 1,
        title: "Test: Italian Greetings",
        prompt: "Write a short beginner-level Italian story about two people meeting for the first time at a café in Rome. Include basic greetings, introductions, and ordering a coffee. Target CEFR A1.",
        status: "draft",
      },
    });
    console.log(`   Created brief: ${created.id}`);
    return created;
  });

  if (!brief) {
    console.log("\n⛔ Cannot continue without a brief.");
    await prisma.$disconnect();
    return;
  }

  // Step 2: Generate story with OpenAI
  const draft = await step("Generate Italian story (OpenAI)", async () => {
    const prompt = brief.prompt || `Write a short beginner-level Italian story about ${brief.topicSlug}. Target CEFR ${brief.level}.`;

    console.log("   Calling OpenAI gpt-4o-mini...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a language learning content creator. Generate a short story in Italian at CEFR ${brief.level} level. Return JSON with: { "title": "...", "text": "...", "synopsis": "...", "vocab": [{"word": "...", "translation": "...", "example": "..."}] }. The story should be 150-300 words, natural Italian, culturally authentic. The vocab should have 8-12 key words with English translations.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty OpenAI response");
    console.log(`   Got ${raw.length} chars from OpenAI`);

    const parsed = JSON.parse(raw);
    console.log(`   Title: "${parsed.title}"`);
    console.log(`   Text: ${parsed.text?.length} chars`);
    console.log(`   Vocab: ${parsed.vocab?.length} items`);

    // Generate slug
    const slug = (parsed.title || "untitled")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80);

    // Save as StoryDraft
    const created = await prisma.storyDraft.create({
      data: {
        briefId: brief.id,
        title: parsed.title || "Untitled Italian Story",
        slug,
        text: parsed.text || "",
        synopsis: parsed.synopsis || "",
        vocab: parsed.vocab || [],
        status: "generated",
        metadata: {
          language: brief.language,
          variant: brief.variant,
          level: brief.level,
          journeyTopic: brief.topicSlug,
          journeyFocus: brief.journeyFocus,
          storySlot: brief.storySlot,
        },
      },
    });

    // Update brief status
    await prisma.curriculumBrief.update({
      where: { id: brief.id },
      data: { status: "generated" },
    });

    console.log(`   Draft saved: ${created.id}`);
    return created;
  });

  if (!draft) {
    console.log("\n⛔ Cannot continue without a draft.");
    await prisma.$disconnect();
    return;
  }

  // Step 3: Simple QA check (structural)
  const qaResult = await step("QA check (structural)", async () => {
    const findings = [];

    // Check text length
    if (draft.text.length < 100) findings.push("Text too short (< 100 chars)");
    if (draft.text.length > 5000) findings.push("Text too long (> 5000 chars)");

    // Check it's actually Italian (basic heuristic)
    const italianMarkers = ["è", "che", "una", "il", "la", "di", "per", "non", "con"];
    const textLower = draft.text.toLowerCase();
    const italianScore = italianMarkers.filter((m) => textLower.includes(m)).length;
    if (italianScore < 3) findings.push(`Low Italian language markers (${italianScore}/9)`);

    // Check vocab
    const vocab = Array.isArray(draft.vocab) ? draft.vocab : [];
    if (vocab.length < 5) findings.push(`Too few vocab items (${vocab.length})`);

    // Check title
    if (!draft.title || draft.title.length < 3) findings.push("Missing or too short title");

    const passed = findings.length === 0;
    const score = Math.max(0, 100 - findings.length * 15);

    console.log(`   Score: ${score}/100`);
    console.log(`   Findings: ${findings.length === 0 ? "None" : findings.join(", ")}`);
    console.log(`   Italian markers found: ${italianScore}/9`);
    console.log(`   Status: ${passed ? "PASS" : "NEEDS REVIEW"}`);

    // Save QA review
    await prisma.qAReview.create({
      data: {
        storyDraftId: draft.id,
        status: passed ? "pass" : "fail",
        score,
        report: { findings, italianScore, textLength: draft.text.length, vocabCount: vocab.length },
      },
    });

    // Update draft status
    await prisma.storyDraft.update({
      where: { id: draft.id },
      data: { status: passed ? "qa_pass" : "qa_fail" },
    });

    return { passed, score, findings };
  });

  // Step 4: Show final result
  console.log(`\n${"═".repeat(50)}`);
  console.log("📊 RESULTS");
  console.log(`${"═".repeat(50)}`);

  const finalDraft = await prisma.storyDraft.findUnique({ where: { id: draft.id } });
  console.log(`Title:    ${finalDraft?.title}`);
  console.log(`Status:   ${finalDraft?.status}`);
  console.log(`Language: ${JSON.stringify(finalDraft?.metadata)}`);
  console.log(`Text preview:\n   "${finalDraft?.text?.slice(0, 300)}..."`);

  if (qaResult?.passed) {
    console.log(`\n✅ Story passed QA! Ready for auto-promote → publish.`);
    console.log(`   Next: autoPromoteDrafts() → publishDraftToSanity(${draft.id})`);
    console.log(`   (Not running Sanity publish in this test to avoid side effects)`);
  } else {
    console.log(`\n⚠️ Story did not pass QA. Would be sent for retry.`);
  }

  await prisma.$disconnect();
  console.log("\n✅ Test complete.");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
