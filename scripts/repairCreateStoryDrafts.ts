import "dotenv/config";
import { getCliClient } from "sanity/cli";

type StandaloneStoryDoc = {
  _id: string;
  _type: "standaloneStory";
  title?: string | null;
  slug?: { _type: "slug"; current?: string | null } | null;
  text?: string | null;
  sourceType?: string | null;
  createStoryId?: string | null;
  createStoryUserId?: string | null;
  cover?: unknown;
  [key: string]: unknown;
};

const sanityClient = getCliClient({
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2025-10-05",
  useCdn: false,
}).withConfig({ perspective: "raw" });

function getPublishedId(id: string) {
  return id.replace(/^drafts\./, "");
}

function needsRepair(doc: StandaloneStoryDoc) {
  return (
    doc._id.startsWith("drafts.create-story.") &&
    doc._type === "standaloneStory" &&
    (!doc.sourceType ||
      !doc.createStoryId ||
      !doc.title ||
      !doc.slug?.current ||
      !doc.text)
  );
}

async function main() {
  const drafts = await sanityClient.fetch<StandaloneStoryDoc[]>(
    `*[_id in path("drafts.create-story.**") && _type == "standaloneStory"]`
  );

  const brokenDrafts = drafts.filter(needsRepair);
  if (brokenDrafts.length === 0) {
    console.log("[repair:create-story-drafts] No broken drafts found.");
    return;
  }

  let repaired = 0;

  for (const draft of brokenDrafts) {
    const publishedId = getPublishedId(draft._id);
    const published = await sanityClient.fetch<StandaloneStoryDoc | null>(
      `*[_id == $id][0]`,
      { id: publishedId }
    );

    if (!published) {
      console.warn(
        `[repair:create-story-drafts] Skipping ${draft._id}: missing published counterpart ${publishedId}.`
      );
      continue;
    }

    const merged: StandaloneStoryDoc = {
      ...published,
      ...draft,
      _id: draft._id,
      _type: "standaloneStory",
      sourceType: draft.sourceType ?? published.sourceType ?? "create",
      createStoryId: draft.createStoryId ?? published.createStoryId ?? null,
      createStoryUserId: draft.createStoryUserId ?? published.createStoryUserId ?? null,
      title: draft.title ?? published.title ?? null,
      slug: draft.slug ?? published.slug ?? null,
      text: draft.text ?? published.text ?? null,
    };

    await sanityClient.createOrReplace(merged);
    repaired += 1;
    console.log(`[repair:create-story-drafts] Repaired ${draft._id}`);
  }

  console.log(`[repair:create-story-drafts] Repaired ${repaired} draft(s).`);
}

main().catch((error) => {
  console.error("[repair:create-story-drafts] Failed:", error);
  process.exitCode = 1;
});
