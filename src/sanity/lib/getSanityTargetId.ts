import type { SanityClient } from "sanity";

export async function getSanityTargetId(
  client: SanityClient,
  formId?: string
): Promise<string> {
  if (!formId) {
    throw new Error("Missing document id.");
  }

  if (formId.startsWith("drafts.")) {
    return formId;
  }

  const draftId = `drafts.${formId}`;
  const existingDraft = await client.fetch<string | null>(
    'coalesce(*[_id == $draftId][0]._id, null)',
    { draftId }
  );

  return existingDraft ? draftId : formId;
}
