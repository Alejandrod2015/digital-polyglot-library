"use client";

// Mounts once per page load and fires a single POST to /api/log/visit.
// Captures everything the server can't see by itself: the SPA-navigated
// path, document.referrer (only meaningful on the first page of a
// session), UTM parameters from the URL, the user's IANA timezone,
// and a coarse device category. The server backfills geo (country,
// region, city) from Vercel edge headers and handles bot filtering.
//
// Uses navigator.sendBeacon so the request survives the user
// navigating away or closing the tab mid-payload. Falls back to a
// fire-and-forget fetch with keepalive when sendBeacon isn't
// available.

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

type ConsentState = "accepted" | "rejected" | "unset";

function readAnalyticsConsent(): ConsentState {
  if (typeof document === "undefined") return "unset";
  try {
    const stored = window.localStorage.getItem("dp.analyticsConsent");
    if (stored === "accepted" || stored === "rejected") return stored;
  } catch {
    // localStorage may throw in some privacy modes.
  }
  return "unset";
}

function deviceCategoryFromUA(ua: string): string {
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/i.test(ua)) return "mobile";
  return "desktop";
}

function send(payload: Record<string, unknown>) {
  const url = "/api/log/visit";
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // sendBeacon requires a Blob with explicit type to set the
      // Content-Type header correctly for the receiving Route Handler.
      const ok = navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      if (ok) return;
    }
  } catch {
    // fall through to fetch
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "include",
  }).catch(() => {});
}

export default function VisitLogger() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Memoize last reported "<path>?<query>" so SPA navigations that
  // re-render this component without a real route change don't fire
  // duplicate inserts.
  const lastReportedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const search = searchParams?.toString() ?? "";
    const key = search ? `${pathname}?${search}` : pathname;
    if (lastReportedRef.current === key) return;
    lastReportedRef.current = key;

    const params = new URLSearchParams(search);
    const utm = (k: string) => params.get(k) ?? undefined;

    const consent = readAnalyticsConsent();

    send({
      path: pathname,
      referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
      landingUrl: typeof window !== "undefined" ? window.location.href : undefined,
      utmSource: utm("utm_source"),
      utmMedium: utm("utm_medium"),
      utmCampaign: utm("utm_campaign"),
      utmContent: utm("utm_content"),
      utmTerm: utm("utm_term"),
      timezone:
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : undefined,
      deviceCategory:
        typeof navigator !== "undefined" ? deviceCategoryFromUA(navigator.userAgent) : undefined,
      preConsent: consent !== "accepted",
    });
  }, [pathname, searchParams]);

  return null;
}
