"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  currentVersion?: string;
};

const POLL_INTERVAL_MS = 60_000;
// Delay before auto-reloading once a new version is detected. Keeps the
// reload from interrupting a click-or-keystroke the user is mid-way
// through. Long enough to feel like a deliberate refresh, short enough
// to load the new bundle on the user's "next page".
const AUTO_RELOAD_DELAY_MS = 1500;

export default function ServiceWorkerBootstrap({ currentVersion = "dev-local" }: Props) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const reloadScheduled = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Register the no-op SW (public/sw.js). It exists only so Chrome
    // considers the site installable and fires beforeinstallprompt,
    // which InstallAppHint listens for. As a one-time migration for
    // users that still have an older caching SW from before this was
    // disabled, also delete any leftover `dp-*` caches that the old
    // SW may have populated.
    const registerNoopServiceWorker = async () => {
      try {
        if ("caches" in window) {
          const cacheKeys = await window.caches.keys();
          await Promise.all(
            cacheKeys
              .filter((key) => key.startsWith("dp-"))
              .map((key) => window.caches.delete(key))
          );
        }
        await navigator.serviceWorker.register("/sw.js");
      } catch (error) {
        // Installability degrades gracefully to the manual hint copy
        // when registration fails (private mode, locked-down policies).
        console.error("[sw] registration failed", error);
      }
    };

    void registerNoopServiceWorker();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!currentVersion || currentVersion === "dev-local") return;

    let cancelled = false;

    const checkForUpdate = async () => {
      try {
        const response = await fetch("/api/version", {
          method: "GET",
          cache: "no-store",
          headers: { "Cache-Control": "no-store" },
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { version?: string };
        const latestVersion = typeof payload.version === "string" ? payload.version.trim() : "";
        if (!cancelled && latestVersion && latestVersion !== currentVersion) {
          setHasUpdate(true);
          if (!reloadScheduled.current) {
            reloadScheduled.current = true;
            // Reload on the user's next idle moment (or after a short
            // delay if they keep the tab active) so the new bundle loads
            // without waiting for a manual click.
            window.setTimeout(() => {
              window.location.reload();
            }, AUTO_RELOAD_DELAY_MS);
          }
        }
      } catch {
        // stay quiet on transient failures
      }
    };

    const intervalId = window.setInterval(() => {
      void checkForUpdate();
    }, POLL_INTERVAL_MS);

    const handleFocus = () => {
      void checkForUpdate();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentVersion]);

  return hasUpdate ? (
    <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.85rem)] z-[80] md:left-[calc(16rem+1rem)] md:right-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-300/20 bg-[#0d2648]/95 px-4 py-3 text-white shadow-2xl backdrop-blur">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">Loading the latest version of Digital Polyglot…</p>
          <p className="text-xs text-blue-100/80">This will only take a moment.</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
        >
          Refresh now
        </button>
      </div>
    </div>
  ) : null;
}
