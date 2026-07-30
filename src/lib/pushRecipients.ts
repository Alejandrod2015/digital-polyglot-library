// Resolve which device tokens should receive a push campaign.
//
// Walks the Clerk user list, reads each user's per-type opt-in
// (`publicMetadata.notificationPrefs`) and stored device tokens
// (`privateMetadata.mobilePushTokens`), and returns the tokens to target,
// SPLIT BY TRANSPORT: iOS tokens go to APNs, Android tokens to FCM. For a
// type-scoped campaign, a user is included only if they have NOT opted out
// of that type.
//
// Hasta 2026-07-29 esto devolvía una lista plana y descartaba todo token
// cuyo provider no fuera "apns", así que un device Android quedaba fuera de
// cualquier campaña aunque hubiera registrado su token.

import { createClerkClient } from "@clerk/backend";
import {
  normalizeNotificationPrefs,
  isNotificationTypeKey,
} from "@/lib/notifications";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export type StoredToken = {
  token?: unknown;
  provider?: unknown;
  platform?: unknown;
};

// Safety cap so a runaway never iterates an unbounded user base.
const MAX_USERS = 5000;
const PAGE_SIZE = 100;

export type RecipientResolution = {
  /** iOS device tokens, for `sendApnsPush`. */
  apnsTokens: string[];
  /** Android device tokens, for `sendFcmPush`. */
  fcmTokens: string[];
  userCount: number;
};

/**
 * Which transport a stored token belongs to, or null if unusable.
 *
 * `provider` is written by the app at registration
 * (`apps/mobile/src/notifications/registerPush.ts`). Android sent the
 * literal "native" before it sent "fcm", so both map to FCM — a device that
 * registered under the old string keeps working without a re-register.
 */
export function classifyStoredToken(entry: StoredToken): "apns" | "fcm" | null {
  if (!entry || typeof entry !== "object") return null;
  const value = typeof entry.token === "string" ? entry.token.trim() : "";
  if (!value) return null;
  if (entry.provider === "apns") return "apns";
  if (entry.provider === "fcm" || entry.provider === "native") return "fcm";
  // Fall back to the platform field for anything written by a future client.
  if (entry.platform === "ios") return "apns";
  if (entry.platform === "android") return "fcm";
  return null;
}

export async function resolvePushRecipients(args: {
  /** all → everyone with a token; type_subscribers → opted-in to the type. */
  target: "all" | "type_subscribers";
  notificationTypeKey: string | null;
}): Promise<RecipientResolution> {
  const { target } = args;
  const typeKey =
    target === "type_subscribers" && isNotificationTypeKey(args.notificationTypeKey)
      ? args.notificationTypeKey
      : null;

  const apnsTokens = new Set<string>();
  const fcmTokens = new Set<string>();
  const matchedUsers = new Set<string>();
  let offset = 0;

  while (offset < MAX_USERS) {
    const page = await clerkClient.users.getUserList({ limit: PAGE_SIZE, offset });
    const users = page.data;
    if (users.length === 0) break;

    for (const user of users) {
      const privateMeta = (user.privateMetadata as Record<string, unknown>) ?? {};
      const rawTokens = privateMeta.mobilePushTokens;
      if (!Array.isArray(rawTokens) || rawTokens.length === 0) continue;

      // Gate by per-type opt-in unless this is an "all" blast.
      if (typeKey) {
        const publicMeta = (user.publicMetadata as Record<string, unknown>) ?? {};
        const prefs = normalizeNotificationPrefs(
          publicMeta.notificationPrefs,
          publicMeta.remindersEnabled === true,
        );
        if (!prefs[typeKey]) continue;
      }

      let added = false;
      for (const entry of rawTokens as StoredToken[]) {
        const transport = classifyStoredToken(entry);
        if (!transport) continue;
        const value = (entry.token as string).trim();
        if (transport === "apns") apnsTokens.add(value);
        else fcmTokens.add(value);
        added = true;
      }
      if (added) matchedUsers.add(user.id);
    }

    if (users.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return {
    apnsTokens: Array.from(apnsTokens),
    fcmTokens: Array.from(fcmTokens),
    userCount: matchedUsers.size,
  };
}
