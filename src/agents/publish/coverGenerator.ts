// Deprecated cover-generation entrypoint. Previously called /api/sanity/
// generate-cover, which has been deleted along with the Sanity Studio
// mount. Studio Next.js owns cover generation now (or the cover is set
// manually via the StandaloneStory editor). Kept as a stub so existing
// callers keep compiling; returns success:false with a clear message.

export async function generateCoverForPublishedStory(_params: {
  sanityId: string;
  draftId: string;
}): Promise<{ success: boolean; coverUrl?: string; error?: string }> {
  return {
    success: false,
    error:
      "generateCoverForPublishedStory is deprecated after the Sanity cutover. Generate covers via Studio Next.js or set coverUrl manually on StandaloneStory.",
  };
}
