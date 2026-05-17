import { createClerkClient } from "@clerk/backend";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { getStudioMembers, isStudioMember } from "@/lib/studio-access";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

// Cache the resolved internal-user list so we don't hit Clerk on every
// dashboard query. The studio team rarely changes and stale entries here
// only mean a few extra/missing rows in the dashboard, not security harm.
type InternalIdsCache = { ids: string[]; loadedAt: number };
let internalIdsCache: InternalIdsCache | null = null;
const INTERNAL_IDS_TTL_MS = 5 * 60 * 1000;

/**
 * Returns the Clerk userIds to exclude from /api/metrics/* dashboards
 * so the numbers reflect external usage only. Two sources are merged:
 *
 *   1) `getStudioMembers()` emails -> Clerk userIds (lookup by email).
 *      Catches anyone who registered with the same email used on the
 *      studio team table.
 *   2) `METRICS_EXCLUDE_USER_IDS` env var (comma-separated). Manual
 *      fallback for testers whose Clerk profile uses a different
 *      email than the studio team table, or for legacy/deleted Clerk
 *      users who still own historical metric rows.
 *
 * Cached for 5 minutes.
 */
export async function getInternalUserIds(): Promise<string[]> {
  if (
    internalIdsCache &&
    Date.now() - internalIdsCache.loadedAt < INTERNAL_IDS_TTL_MS
  ) {
    return internalIdsCache.ids;
  }
  const members = await getStudioMembers();
  const emails = members
    .map((m) => m.email.trim().toLowerCase())
    .filter(Boolean);

  const ids: string[] = [];
  for (const email of emails) {
    try {
      const list = await clerkClient.users.getUserList({
        emailAddress: [email],
        limit: 10,
      });
      for (const user of list.data) {
        ids.push(user.id);
      }
    } catch (error) {
      console.warn("[metricsAccess] failed to resolve internal user", email, error);
    }
  }

  // Manual override: tester userIds set in Vercel env. Useful for
  // accounts whose Clerk email doesn't match the studio_members row,
  // or for stale/deleted Clerk users that still have rows in
  // UserMetric we want to ignore.
  const manualEnv = process.env.METRICS_EXCLUDE_USER_IDS ?? "";
  for (const id of manualEnv.split(",").map((s) => s.trim()).filter(Boolean)) {
    ids.push(id);
  }

  const unique = Array.from(new Set(ids));
  internalIdsCache = { ids: unique, loadedAt: Date.now() };
  return unique;
}

export async function isMetricsAccessAllowed(req: NextRequest): Promise<boolean> {
  // Always allow in dev
  if (process.env.NODE_ENV !== "production") return true;

  // Check API key first (fast path for external tools)
  const expectedKey = process.env.METRICS_DASHBOARD_KEY;
  if (expectedKey) {
    const headerKey = req.headers.get("x-metrics-key")?.trim();
    const queryKey = req.nextUrl.searchParams.get("key")?.trim();
    const providedKey = headerKey || queryKey;
    if (providedKey && providedKey === expectedKey) return true;
  }

  // Check studio membership via Clerk user email
  const { userId } = getAuth(req);
  if (!userId) return false;

  try {
    const user = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) return false;
    return isStudioMember(email);
  } catch {
    return false;
  }
}
