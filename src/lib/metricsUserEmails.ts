// Resolve Clerk userIds to their primary email, with a process-wide cache.
// Shared by the metrics dashboard and the notification-effectiveness lib so
// both surfaces resolve emails the same way (and share the cache).

import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
const userEmailCache = new Map<string, string | null>();

export async function resolveUserEmails(
  userIds: string[]
): Promise<Map<string, string | null>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const byUserId = new Map<string, string | null>();

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      if (userEmailCache.has(userId)) {
        byUserId.set(userId, userEmailCache.get(userId) ?? null);
        return;
      }

      try {
        const user = await clerkClient.users.getUser(userId);
        const email = user.emailAddresses[0]?.emailAddress ?? null;
        userEmailCache.set(userId, email);
        byUserId.set(userId, email);
      } catch (error) {
        const status =
          typeof error === "object" &&
          error !== null &&
          "status" in error &&
          typeof (error as { status?: unknown }).status === "number"
            ? (error as { status: number }).status
            : null;

        if (status !== 404) {
          console.warn("resolveUserEmails: failed to resolve Clerk user", userId, error);
        }

        userEmailCache.set(userId, null);
        byUserId.set(userId, null);
      }
    })
  );

  return byUserId;
}
