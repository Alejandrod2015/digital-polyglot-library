import * as SecureStore from "expo-secure-store";

const CREATE_PENDING_KEY_PREFIX = "digital-polyglot/mobile-create-pending";

export type MobilePendingCreateStory = {
  id: string;
  slug: string;
  title: string;
  text: string;
  language?: string;
  variant?: string | null;
  region?: string | null;
  level?: string;
  cefrLevel?: string;
  topic?: string;
  audioStatus?: string | null;
  audioUrl?: string | null;
  coverUrl?: string | null;
};

export type MobilePendingCreate = {
  startedAt: number;
  storyId: string | null;
  lastKnownStory: MobilePendingCreateStory | null;
  payload: {
    language: string;
    variant?: string;
    region?: string;
    level: string;
    cefrLevel: string;
    focus: string;
    topic: string;
  } | null;
};

function getPendingCreateKey(userId?: string | null) {
  return `${CREATE_PENDING_KEY_PREFIX}:${userId || "guest"}`;
}

function isPendingCreate(value: unknown): value is MobilePendingCreate {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as MobilePendingCreate).startedAt === "number" &&
    ("storyId" in (value as MobilePendingCreate)) &&
    ("lastKnownStory" in (value as MobilePendingCreate))
  );
}

export async function loadPendingCreate(userId?: string | null): Promise<MobilePendingCreate | null> {
  try {
    const raw = await SecureStore.getItemAsync(getPendingCreateKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isPendingCreate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function savePendingCreate(
  userId: string | null | undefined,
  pending: MobilePendingCreate
): Promise<void> {
  try {
    await SecureStore.setItemAsync(getPendingCreateKey(userId), JSON.stringify(pending));
  } catch {
    // Best effort only.
  }
}

export async function clearPendingCreate(userId?: string | null): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(getPendingCreateKey(userId));
  } catch {
    // Best effort only.
  }
}
