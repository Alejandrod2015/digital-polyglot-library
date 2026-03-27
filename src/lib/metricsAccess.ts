import { getAuth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";

export function isMetricsAccessAllowed(req: NextRequest): boolean {
  // Always allow in dev
  if (process.env.NODE_ENV !== "production") return true;

  // Allow authenticated Clerk users (studio access)
  const { userId } = getAuth(req);
  if (userId) return true;

  // Fallback: API key for external tools
  const expectedKey = process.env.METRICS_DASHBOARD_KEY;
  if (!expectedKey) return false;

  const headerKey = req.headers.get("x-metrics-key")?.trim();
  const queryKey = req.nextUrl.searchParams.get("key")?.trim();
  const providedKey = headerKey || queryKey;

  return Boolean(providedKey && providedKey === expectedKey);
}
