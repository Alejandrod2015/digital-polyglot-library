import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { writeClient } from "@/sanity/lib/client";

export const maxDuration = 60;

const DEFAULT_VARIANT: Record<string, string> = {
  spanish: "latam", english: "us", portuguese: "brazil", french: "france", italian: "italy", german: "germany",
};
const REGION_FIELD: Record<string, string> = {
  spanish: "region_es", english: "region_en", portuguese: "region_pt", french: "region_fr", italian: "region_it", german: "region_de",
};
const VARIANT_TO_REGION: Record<string, string> = {
  latam: "colombia", spain: "spain", us: "usa", uk: "uk", brazil: "brazil", portugal: "portugal", france: "france", italy: "italy", germany: "germany",
};

/**
 * POST /api/studio/pipeline/publish-story
 *
 * MVP: publishes a story directly to Sanity as standaloneStory.
 * Body: { title, slug, text, synopsis, vocab, language, variant, level, topic }
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

  const { title, slug, text, synopsis, vocab, language, variant, level, topic } = body;
  if (!title || !slug || !text || !language || !level)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  try {
    const lang = language.toLowerCase();
    const var_ = (variant || DEFAULT_VARIANT[lang] || lang).toLowerCase();
    const regionField = REGION_FIELD[lang];
    const regionValue = VARIANT_TO_REGION[var_];
    const sanityId = `standalone-${slug}`;

    const doc: Record<string, unknown> = {
      _id: sanityId,
      _type: "standaloneStory",
      title,
      slug: { _type: "slug", current: slug },
      text,
      synopsis: synopsis || "",
      vocabRaw: Array.isArray(vocab) ? JSON.stringify(vocab) : "[]",
      language: lang,
      variant: var_,
      cefrLevel: level,
      focus: "mixed",
      topic: topic || "",
      journeyEligible: true,
      journeyTopic: topic || "",
      journeyOrder: 1,
      journeyFocus: "General",
      sourceType: "sanity",
      published: true,
    };

    if (regionField && regionValue) doc[regionField] = regionValue;

    await writeClient.createOrReplace(doc as any);

    return NextResponse.json({ success: true, sanityId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
