"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type PendingNav = {
  t: number;
  from: string;
  to: string;
};

type WindowWithNavMetrics = Window & {
  __dp_nav_metrics__?: Array<{ from: string; to: string; ms: number; at: string }>;
};

const STORAGE_KEY = "__dp_nav_start_v1";

function isModifiedClick(e: MouseEvent): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

export default function NavigationTimingTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (isModifiedClick(e)) return;
      const target = e.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      const toUrl = new URL(anchor.href, window.location.href);
      if (toUrl.origin !== window.location.origin) return;

      const from = `${window.location.pathname}${window.location.search}`;
      const to = `${toUrl.pathname}${toUrl.search}`;
      if (from === to) return;

      const pending: PendingNav = {
        t: performance.now(),
        from,
        to,
      };

      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
      } catch {
        // ignore
      }
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  useEffect(() => {
    const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    let parsed: PendingNav | null = null;

    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      parsed = JSON.parse(raw) as PendingNav;
    } catch {
      return;
    } finally {
      try {
        window.sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }

    if (!parsed) return;
    if (parsed.to !== current) return;

    const ms = Math.round((performance.now() - parsed.t) * 10) / 10;
    const entry = {
      from: parsed.from,
      to: parsed.to,
      ms,
      at: new Date().toISOString(),
    };

    const w = window as WindowWithNavMetrics;
    const prev = Array.isArray(w.__dp_nav_metrics__) ? w.__dp_nav_metrics__ : [];
    w.__dp_nav_metrics__ = [...prev.slice(-49), entry];

    // Example:
    // [nav-timing] / -> /explore in 182.5ms
    // Access recent samples in console with: window.__dp_nav_metrics__
    console.info(`[nav-timing] ${entry.from} -> ${entry.to} in ${entry.ms}ms`);
  }, [pathname, searchParams]);

  return null;
}
