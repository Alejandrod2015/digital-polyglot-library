import { createClerkClient } from "@clerk/backend";
import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { isStudioMember } from "@/lib/studio-access";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

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
