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
  region?: string;
  level?: string;
  topic?: string;
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
  if (existing.exists) return destination;

  try {
    const result = await FileSystem.downloadAsync(remoteUrl, destination);
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
    coverUrl: story.cover ?? book.cover ?? "",
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
