import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import {
  generateStoryWithLLM,
  generateVocabFromText,
  generateSynopsis,
  generateSlug,
} from "@/agents/content/tools";
import { loadPedagogicalRules } from "@/agents/config/pedagogicalConfig";

export const maxDuration = 60;

/**
 * POST /api/studio/pipeline/generate-story
 *
 * MVP: generates a single story directly from params (no brief needed).
 * Body: { language, variant, level, topic }
 * Returns: { title, slug, text, synopsis, vocab, wordCount }
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, any> = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { language, variant, level, topic } = body;
  if (!language || !level || !topic)
    return NextResponse.json({ error: "language, level, and topic are required" }, { status: 400 });

  try {
    await loadPedagogicalRules();

    const generated = await generateStoryWithLLM({
      title: "",
      language,
      level,
      topic,
      journeyFocus: "General",
      variant: variant || undefined,
    });

    const vocab = await generateVocabFromText({
      text: generated.text,
      language,
      level,
      topic,
    });

    const synopsis = await generateSynopsis({
      title: generated.title,
      text: generated.text,
      language,
    });

    const slug = generateSlug(generated.title, language, variant || language, 1);
    const wordCount = generated.text.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      title: generated.title,
      slug,
      text: generated.text,
      synopsis,
      vocab,
      wordCount,
      vocabCount: vocab.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
