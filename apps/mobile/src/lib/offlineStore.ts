import * as FileSystem from "expo-file-system/legacy";
import type { Book, Story } from "@digital-polyglot/domain";

export type OfflineLibraryBook = {
  id: string;
  bookId: string;
  title: string;
  coverUrl: string;
  localCoverUri?: string | null;
};

export type OfflineLibraryStory = {
  id: string;
  storyId: string;
  bookId: string;
  title: string;
  coverUrl: string;
  storySlug?: string;
  bookSlug?: string;
  language?: string;
  variant?: string;
  region?: string;
  level?: string;
  cefrLevel?: string;
  topic?: string;
  text?: string | null;
  // JSON-encoded VocabItem[] from the remote story payload. Persisted so the
  // reader can highlight vocabulary when opening the story offline (or when
  // the offline copy is used even online to skip the network fetch).
  vocabRaw?: string | null;
  audioUrl?: string | null;
  localCoverUri?: string | null;
  localAudioUri?: string | null;
};

export type OfflineReadingProgress = {
  bookId: string;
  storyId: string;
  title: string;
  updatedAt: string;
};

export type OfflineLibrarySnapshot = {
  books: OfflineLibraryBook[];
  stories: OfflineLibraryStory[];
  progress: OfflineReadingProgress[];
  savedAt: string;
};

const OFFLINE_ROOT = `${FileSystem.documentDirectory ?? ""}digital-polyglot`;
const MEDIA_ROOT = `${OFFLINE_ROOT}/media`;

function getSnapshotPath(userId: string): string {
  return `${OFFLINE_ROOT}/offline-${userId}.json`;
}

async function ensureRootDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(OFFLINE_ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(OFFLINE_ROOT, { intermediates: true });
  }

  const mediaInfo = await FileSystem.getInfoAsync(MEDIA_ROOT);
  if (!mediaInfo.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_ROOT, { intermediates: true });
  }
}

async function ensureMediaDirectory(kind: "images" | "audio"): Promise<string> {
  await ensureRootDirectory();
  const path = `${MEDIA_ROOT}/${kind}`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
  return path;
}

function buildMediaPath(kind: "images" | "audio", key: string, sourceUrl: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "-");
  const cleanUrl = sourceUrl.split("?")[0] ?? sourceUrl;
  const maybeExtension = cleanUrl.split(".").pop() ?? "";
  const extension = maybeExtension && maybeExtension.length <= 5 ? maybeExtension : "bin";
  return `${MEDIA_ROOT}/${kind}/${safeKey}.${extension}`;
}

// MIN_AUDIO_BYTES is deliberately small — just large enough to reject
// zero-byte or a few-header-bytes failures. We do NOT use this as a
// quality threshold; the real validation is Content-Length vs on-disk
// size below.
const MIN_AUDIO_BYTES = 1024;
const MAX_DOWNLOAD_ATTEMPTS = 3;

/**
 * Download a remote file to disk with resumable transfer, Content-Length
 * validation, and exponential backoff retries. Returns the local URI when
 * the downloaded file is trustworthy; `null` otherwise. Any intermediate
 * failure scrubs the partial file from disk so the next attempt starts
 * clean. Never throws — all errors turn into `null`.
 */
async function downloadResumableWithValidation(
  remoteUrl: string,
  destination: string
): Promise<string | null> {
  let backoffMs = 1000;
  for (let attempt = 0; attempt < MAX_DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      const downloader = FileSystem.createDownloadResumable(remoteUrl, destination);
      const result = await downloader.downloadAsync();
      if (!result) throw new Error("download-null");
      if (result.status >= 400) throw new Error(`http-${result.status}`);

      const info = await FileSystem.getInfoAsync(result.uri);
      if (!info.exists) throw new Error("file-missing");
      const localSize = info.size ?? 0;

      // Prefer Content-Length for a strict byte-exact check. Fall back to
      // the "must be at least MIN bytes" heuristic when the server didn't
      // send it (R2 always sends Content-Length for static assets).
      const headers = (result.headers ?? {}) as Record<string, string>;
      const rawContentLength = headers["content-length"] ?? headers["Content-Length"];
      const expectedSize =
        rawContentLength && /^\d+$/.test(rawContentLength) ? Number(rawContentLength) : null;

      if (expectedSize !== null && expectedSize > 0) {
        if (localSize !== expectedSize) {
          throw new Error(`size-mismatch-${localSize}-of-${expectedSize}`);
        }
      } else if (localSize < MIN_AUDIO_BYTES) {
        throw new Error(`tiny-file-${localSize}`);
      }

      return result.uri;
    } catch (err) {
      console.warn("[offline-dl] attempt failed", {
        attempt: attempt + 1,
        url: remoteUrl,
        error: err instanceof Error ? err.message : String(err),
      });
      // Scrub any partial/corrupt file before retrying.
      try {
        await FileSystem.deleteAsync(destination, { idempotent: true });
      } catch {
        // ignore
      }
      if (attempt < MAX_DOWNLOAD_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        backoffMs *= 2;
      }
    }
  }
  return null;
}

async function cacheRemoteFile(args: {
  kind: "images" | "audio";
  key: string;
  sourceUrl?: string | null;
}): Promise<string | null> {
  const remoteUrl = typeof args.sourceUrl === "string" ? args.sourceUrl.trim() : "";
  if (!remoteUrl || !/^https?:\/\//.test(remoteUrl)) return null;

  await ensureMediaDirectory(args.kind);
  const destination = buildMediaPath(args.kind, args.key, remoteUrl);
  const existing = await FileSystem.getInfoAsync(destination);
  if (existing.exists) {
    const cachedSize = existing.size ?? 0;
    if (cachedSize >= MIN_AUDIO_BYTES) {
      return destination;
    }
    // Zero-byte / clearly truncated cache from a previous build: drop it so
    // the resumable downloader below gets a clean slate.
    try {
      await FileSystem.deleteAsync(destination, { idempotent: true });
    } catch {
      // ignore
    }
  }

  // Try the robust path (resumable + validated + retries). If it returns
  // null we fall back to the simpler one-shot downloadAsync as a last
  // resort — this keeps the previous behaviour intact in the unlikely
  // event that createDownloadResumable itself has a problem on some iOS
  // version, so we never get worse than before.
  const robust = await downloadResumableWithValidation(remoteUrl, destination);
  if (robust) return robust;

  try {
    const result = await FileSystem.downloadAsync(remoteUrl, destination);
    if (result.status >= 400) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
      return null;
    }
    const info = await FileSystem.getInfoAsync(result.uri);
    if (!info.exists || (info.size ?? 0) < MIN_AUDIO_BYTES) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
      return null;
    }
    return result.uri;
  } catch {
    return null;
  }
}

export async function loadOfflineSnapshot(userId: string): Promise<OfflineLibrarySnapshot | null> {
  await ensureRootDirectory();
  const path = getSnapshotPath(userId);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return null;

  try {
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as Partial<OfflineLibrarySnapshot>;
    return {
      books: Array.isArray(parsed.books) ? parsed.books : [],
      stories: Array.isArray(parsed.stories) ? parsed.stories : [],
      progress: Array.isArray(parsed.progress) ? parsed.progress : [],
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function saveOfflineSnapshot(
  userId: string,
  snapshot: OfflineLibrarySnapshot
): Promise<void> {
  await ensureRootDirectory();
  const path = getSnapshotPath(userId);
  await FileSystem.writeAsStringAsync(path, JSON.stringify(snapshot));
}

export async function updateOfflineProgress(
  userId: string,
  entry: OfflineReadingProgress
): Promise<OfflineLibrarySnapshot | null> {
  const current = (await loadOfflineSnapshot(userId)) ?? {
    books: [],
    stories: [],
    progress: [],
    savedAt: new Date().toISOString(),
  };

  const nextProgress = [
    entry,
    ...current.progress.filter((item) => item.storyId !== entry.storyId),
  ].slice(0, 12);

  const nextSnapshot: OfflineLibrarySnapshot = {
    ...current,
    progress: nextProgress,
    savedAt: new Date().toISOString(),
  };

  await saveOfflineSnapshot(userId, nextSnapshot);
  return nextSnapshot;
}

export async function hydrateOfflineAssets(
  userId: string,
  snapshot: OfflineLibrarySnapshot
): Promise<OfflineLibrarySnapshot> {
  const books = await Promise.all(
    snapshot.books.map(async (book) => ({
      ...book,
      localCoverUri:
        book.localCoverUri ??
        (await cacheRemoteFile({
          kind: "images",
          key: `book-${userId}-${book.bookId}`,
          sourceUrl: book.coverUrl,
        })),
    }))
  );

  const stories = await Promise.all(
    snapshot.stories.map(async (story) => ({
      ...story,
      localCoverUri:
        story.localCoverUri ??
        (await cacheRemoteFile({
          kind: "images",
          key: `story-cover-${userId}-${story.storyId}`,
          sourceUrl: story.coverUrl,
        })),
      localAudioUri:
        story.localAudioUri ??
        (await cacheRemoteFile({
          kind: "audio",
          key: `story-audio-${userId}-${story.storyId}`,
          sourceUrl: story.audioUrl,
        })),
    }))
  );

  const nextSnapshot: OfflineLibrarySnapshot = {
    ...snapshot,
    books,
    stories,
    savedAt: new Date().toISOString(),
  };

  await saveOfflineSnapshot(userId, nextSnapshot);
  return nextSnapshot;
}

function toOfflineBook(book: Book): OfflineLibraryBook {
  return {
    id: `book-${book.id}`,
    bookId: book.id,
    title: book.title,
    coverUrl: book.cover ?? "",
  };
}

function toOfflineStory(book: Book, story: Story): OfflineLibraryStory {
  return {
    id: `story-${story.id}`,
    storyId: story.id,
    bookId: book.id,
    title: story.title,
    coverUrl: story.cover ?? story.coverUrl ?? book.cover ?? "",
    storySlug: story.slug,
    bookSlug: book.slug,
    language: story.language ?? book.language,
    region: story.region ?? book.region,
    level: story.level ?? book.level,
    topic: story.topic ?? book.topic,
    audioUrl: story.audio,
  };
}

export async function saveStoryOffline(
  userId: string,
  book: Book,
  story: Story
): Promise<OfflineLibrarySnapshot> {
  const current = (await loadOfflineSnapshot(userId)) ?? {
    books: [],
    stories: [],
    progress: [],
    savedAt: new Date().toISOString(),
  };

  const nextBooks = current.books.some((item) => item.bookId === book.id)
    ? current.books
    : [...current.books, toOfflineBook(book)];

  const nextStories = current.stories.some((item) => item.storyId === story.id)
    ? current.stories.map((item) => (item.storyId === story.id ? { ...item, ...toOfflineStory(book, story) } : item))
    : [...current.stories, toOfflineStory(book, story)];

  return hydrateOfflineAssets(userId, {
    ...current,
    books: nextBooks,
    stories: nextStories,
    savedAt: new Date().toISOString(),
  });
}

export async function saveStandaloneStoryOffline(
  userId: string,
  story: {
    id: string;
    slug: string;
    title: string;
    text: string;
    vocabRaw?: string | null;
    language?: string | null;
    variant?: string | null;
    region?: string | null;
    level?: string | null;
    cefrLevel?: string | null;
    topic?: string | null;
    coverUrl?: string | null;
    audioUrl?: string | null;
  }
): Promise<OfflineLibrarySnapshot> {
  const current = (await loadOfflineSnapshot(userId)) ?? {
    books: [],
    stories: [],
    progress: [],
    savedAt: new Date().toISOString(),
  };

  const storyRecord: OfflineLibraryStory = {
    id: `story-${story.id}`,
    storyId: story.id,
    bookId: "standalone-book",
    title: story.title,
    coverUrl: story.coverUrl ?? "",
    storySlug: story.slug,
    bookSlug: "standalone-stories",
    language: story.language ?? undefined,
    variant: story.variant ?? undefined,
    region: story.region ?? undefined,
    level: story.level ?? undefined,
    cefrLevel: story.cefrLevel ?? undefined,
    topic: story.topic ?? undefined,
    text: story.text,
    vocabRaw: story.vocabRaw ?? undefined,
    audioUrl: story.audioUrl ?? undefined,
  };

  const nextStories = current.stories.some((s) => s.storyId === story.id)
    ? current.stories.map((s) => (s.storyId === story.id ? { ...s, ...storyRecord } : s))
    : [...current.stories, storyRecord];

  return hydrateOfflineAssets(userId, {
    ...current,
    stories: nextStories,
    savedAt: new Date().toISOString(),
  });
}

export async function removeStoryOffline(
  userId: string,
  storyId: string
): Promise<OfflineLibrarySnapshot> {
  const current = (await loadOfflineSnapshot(userId)) ?? {
    books: [],
    stories: [],
    progress: [],
    savedAt: new Date().toISOString(),
  };

  const remainingStories = current.stories.filter((item) => item.storyId !== storyId);
  const remainingBookIds = new Set(remainingStories.map((item) => item.bookId));
  const remainingBooks = current.books.filter((item) => remainingBookIds.has(item.bookId));

  const nextSnapshot: OfflineLibrarySnapshot = {
    ...current,
    books: remainingBooks,
    stories: remainingStories,
    savedAt: new Date().toISOString(),
  };

  await saveOfflineSnapshot(userId, nextSnapshot);
  return nextSnapshot;
}
