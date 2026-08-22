// Resolve which device tokens should receive a push campaign.
//
// Walks the Clerk user list, reads each user's per-type opt-in
// (`publicMetadata.notificationPrefs`) and stored APNs tokens
// (`privateMetadata.mobilePushTokens`), and returns the flat list of
// tokens to target. For a type-scoped campaign, a user is included only
// if they have NOT opted out of that type.

import { createClerkClient } from "@clerk/backend";
import {
  normalizeNotificationPrefs,
  isNotificationTypeKey,
  type NotificationTypeKey,
} from "@/lib/notifications";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

type StoredToken = {
  token?: unknown;
  provider?: unknown;
  platform?: unknown;
};

// Safety cap so a runaway never iterates an unbounded user base.
const MAX_USERS = 5000;
const PAGE_SIZE = 100;

export type RecipientResolution = {
  tokens: string[];
  userCount: number;
};

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

  const tokens = new Set<string>();
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
        if (!entry || typeof entry !== "object") continue;
        if (entry.provider !== "apns") continue;
        const value = typeof entry.token === "string" ? entry.token.trim() : "";
        if (!value) continue;
        tokens.add(value);
        added = true;
      }
      if (added) matchedUsers.add(user.id);
    }

    if (users.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { tokens: Array.from(tokens), userCount: matchedUsers.size };
}

export type UserPushTarget = {
  /** Tokens APNs del usuario. */
  tokens: string[];
  /** No tiene token de iOS pero sí de otro proveedor (hoy, Android sin emisor). */
  androidOnly: boolean;
  /** Si tiene encendido ese tipo de notificación. */
  optedIn: boolean;
};

/**
 * La misma resolución que `resolvePushRecipients`, pero para UN usuario: los
 * avisos que nacen de una señal suya (historia a medias, palabra olvidada) ya
 * saben a quién van, y recorrer la lista entera de Clerk para encontrarlo sería
 * absurdo. `androidOnly` se devuelve aparte para que quien informa distinga
 * "no le llega porque no hay emisor FCM" de "falló la entrega".
 */
export async function getUserPushTarget(
  userId: string,
  typeKey: NotificationTypeKey,
): Promise<UserPushTarget> {
  const user = await clerkClient.users.getUser(userId);
  const publicMeta = (user.publicMetadata as Record<string, unknown>) ?? {};
  const prefs = normalizeNotificationPrefs(
    publicMeta.notificationPrefs,
    publicMeta.remindersEnabled === true,
  );
  const raw = ((user.privateMetadata as Record<string, unknown>) ?? {}).mobilePushTokens;
  const entries = Array.isArray(raw) ? (raw as StoredToken[]) : [];
  const tokens: string[] = [];
  let other = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const value = typeof entry.token === "string" ? entry.token.trim() : "";
    if (!value) continue;
    if (entry.provider === "apns") tokens.push(value);
    else other += 1;
  }
  return { tokens, androidOnly: tokens.length === 0 && other > 0, optedIn: prefs[typeKey] === true };
}
