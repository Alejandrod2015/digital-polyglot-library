import { NextRequest } from "next/server";

export function isMetricsAccessAllowed(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const expectedKey = process.env.METRICS_DASHBOARD_KEY;
  if (!expectedKey) return false;

  const headerKey = req.headers.get("x-metrics-key")?.trim();
  const queryKey = req.nextUrl.searchParams.get("key")?.trim();
  const providedKey = headerKey || queryKey;

  return Boolean(providedKey && providedKey === expectedKey);
}
