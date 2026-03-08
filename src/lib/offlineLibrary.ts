import type { Book, Story } from "@/types/books";

const DB_NAME = "digital-polyglot-offline";
const DB_VERSION = 1;
const BOOK_STORE = "books";
const STORY_STORE = "stories";

export type OfflineBookSummary = {
  bookId: string;
  title: string;
  coverUrl: string;
};

export type OfflineStorySummary = {
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
};

type OfflineBookRecord = OfflineBookSummary & {
  key: string;
  userId: string;
  savedAt: number;
  bookData?: Book;
};

type OfflineStoryRecord = OfflineStorySummary & {
  key: string;
  userId: string;
  savedAt: number;
  storyData?: Story;
};

function hasIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function getBookKey(userId: string, bookId: string) {
  return `${userId}:${bookId}`;
}

function getStoryKey(userId: string, storyId: string) {
  return `${userId}:${storyId}`;
}

async function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return null;

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOK_STORE)) {
        db.createObjectStore(BOOK_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORY_STORE)) {
        db.createObjectStore(STORY_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => Promise<T>
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;

  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = await handler(store);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  db.close();
  return result;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineBook(
  userId: string,
  payload: OfflineBookSummary & { bookData?: Book }
) {
  const record: OfflineBookRecord = {
    key: getBookKey(userId, payload.bookId),
    userId,
    savedAt: Date.now(),
    ...payload,
  };

  await withStore(BOOK_STORE, "readwrite", async (store) => {
    await requestToPromise(store.put(record));
    return null;
  });
}

export async function removeOfflineBook(userId: string, bookId: string) {
  await withStore(BOOK_STORE, "readwrite", async (store) => {
    await requestToPromise(store.delete(getBookKey(userId, bookId)));
    return null;
  });
}

export async function listOfflineBooks(userId: string): Promise<OfflineBookSummary[]> {
  const result = await withStore(BOOK_STORE, "readonly", async (store) => {
    const records = (await requestToPromise(store.getAll())) as OfflineBookRecord[];
    return records
      .filter((record) => record.userId === userId)
      .sort((a, b) => b.savedAt - a.savedAt)
      .map(({ bookId, title, coverUrl }) => ({ bookId, title, coverUrl }));
  });

  return result ?? [];
}

export async function saveOfflineStory(
  userId: string,
  payload: OfflineStorySummary & { storyData?: Story }
) {
  const record: OfflineStoryRecord = {
    key: getStoryKey(userId, payload.storyId),
    userId,
    savedAt: Date.now(),
    ...payload,
  };

  await withStore(STORY_STORE, "readwrite", async (store) => {
    await requestToPromise(store.put(record));
    return null;
  });
}

export async function removeOfflineStory(userId: string, storyId: string) {
  await withStore(STORY_STORE, "readwrite", async (store) => {
    await requestToPromise(store.delete(getStoryKey(userId, storyId)));
    return null;
  });
}

export async function listOfflineStories(userId: string): Promise<OfflineStorySummary[]> {
  const result = await withStore(STORY_STORE, "readonly", async (store) => {
    const records = (await requestToPromise(store.getAll())) as OfflineStoryRecord[];
    return records
      .filter((record) => record.userId === userId)
      .sort((a, b) => b.savedAt - a.savedAt)
      .map(
        ({
          storyId,
          bookId,
          title,
          coverUrl,
          storySlug,
          bookSlug,
          language,
          region,
          level,
          topic,
          audioUrl,
        }) => ({
          storyId,
          bookId,
          title,
          coverUrl,
          storySlug,
          bookSlug,
          language,
          region,
          level,
          topic,
          audioUrl,
        })
      );
  });

  return result ?? [];
}
