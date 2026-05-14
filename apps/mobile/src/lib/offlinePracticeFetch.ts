import type { AudioWordTimingsPayload } from "@digital-polyglot/domain";

import type { PracticeFavoriteItem } from "../../../../src/lib/practiceExercises";
import type { AudioSegment } from "../../../../src/lib/audioSegments";

import {
  buildPracticeItemsFromStory,
  parseLooseVocab,
} from "./storyPracticeItems";
import { buildOfflineAudioClipsForVocab } from "./offlineAudioClips";
import type { OfflineLibrarySnapshot, OfflineLibraryStory } from "./offlineStore";

export type OfflinePracticeBundle = {
  items: PracticeFavoriteItem[];
  audio: {
    audioUrl: string | null;
    audioSegments: AudioSegment[];
  };
  storySource: "standalone" | "user";
};

function normalizeSlug(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function findOfflineStory(
  snapshot: OfflineLibrarySnapshot | null | undefined,
  storySlug: string
): OfflineLibraryStory | null {
  if (!snapshot?.stories?.length) return null;
  const target = normalizeSlug(storySlug);
  if (!target) return null;
  return (
    snapshot.stories.find((story) => normalizeSlug(story.storySlug) === target) ??
    null
  );
}

function parseAudioWordTimings(raw: string | null | undefined): AudioWordTimingsPayload | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AudioWordTimingsPayload> | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.words) || parsed.words.length === 0) return null;
    return parsed as AudioWordTimingsPayload;
  } catch {
    return null;
  }
}

/**
 * Build a sourcePath that matches what the server constructs in
 * `/api/story-practice`. Catalog book stories get `/books/<book>/<story>`;
 * standalone-flavored copies (downloaded via `saveStandaloneStoryOffline`)
 * get `/stories/<slug>`. The query-string marker `source=standalone` is
 * intentionally omitted because the mobile `getStorySource` heuristic
 * doesn't depend on it (no `standaloneStorySlugs` registry on mobile);
 * routing to the right audio map is decided locally below.
 */
function deriveSourcePath(story: OfflineLibraryStory): string {
  const slug = story.storySlug ?? "";
  const bookSlug = story.bookSlug ?? "";
  const isStandaloneShape =
    bookSlug === "standalone-stories" || bookSlug.startsWith("generated-book-") || !bookSlug;
  if (!isStandaloneShape) {
    return `/books/${bookSlug}/${slug}`;
  }
  return `/stories/${slug}`;
}

function deriveStorySource(story: OfflineLibraryStory): "standalone" | "user" {
  const bookSlug = story.bookSlug ?? "";
  if (!bookSlug || bookSlug === "standalone-stories" || bookSlug.startsWith("generated-book-")) {
    return "standalone";
  }
  return "user";
}

/**
 * Build a complete practice bundle (items + sentence-level audio segments)
 * entirely from the local offline snapshot. Returns null when the snapshot
 * doesn't have the three fields required to make the bundle useful for
 * practice: `text`, `vocabRaw`, and `wordTimingsRaw`. Premium gating is the
 * caller's responsibility.
 */
export function tryBuildOfflineStoryPractice(params: {
  storySlug: string;
  offlineSnapshot: OfflineLibrarySnapshot | null | undefined;
}): OfflinePracticeBundle | null {
  const offlineStory = findOfflineStory(params.offlineSnapshot, params.storySlug);
  if (!offlineStory) return null;

  const text = typeof offlineStory.text === "string" ? offlineStory.text.trim() : "";
  if (!text) return null;

  const vocab = parseLooseVocab(offlineStory.vocabRaw ?? null);
  if (vocab.length === 0) return null;

  const audioWordTimings = parseAudioWordTimings(offlineStory.wordTimingsRaw ?? null);
  if (!audioWordTimings) return null;

  const sourcePath = deriveSourcePath(offlineStory);
  const items = buildPracticeItemsFromStory({
    title: offlineStory.title,
    slug: offlineStory.storySlug ?? params.storySlug,
    text,
    language: offlineStory.language ?? null,
    sourcePath,
    vocab,
    practiceSource: "curriculum",
  });
  if (items.length === 0) return null;

  const audioSegments = buildOfflineAudioClipsForVocab({
    vocab,
    audioWordTimings,
    storyPlainText: text,
  });

  return {
    items,
    audio: {
      audioUrl: offlineStory.localAudioUri ?? offlineStory.audioUrl ?? null,
      audioSegments,
    },
    storySource: deriveStorySource(offlineStory),
  };
}
