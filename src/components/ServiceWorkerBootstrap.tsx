"use client";

import { useEffect, useState } from "react";

type Props = {
  currentVersion?: string;
};

const POLL_INTERVAL_MS = 60_000;

export default function ServiceWorkerBootstrap({ currentVersion = "dev-local" }: Props) {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const unregisterAllServiceWorkers = async () => {
      try {
        const hadController = Boolean(navigator.serviceWorker.controller);
        const registrations = await navigator.serviceWorker.getRegistrations();
        const hadRegistrations = registrations.length > 0;

        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.filter((key) => key.startsWith("dp-")).map((key) => window.caches.delete(key)));
        }

        const reloadKey = "dp-sw-cleanup-reloaded";
        const shouldReload =
          (hadController || hadRegistrations) &&
          window.sessionStorage.getItem(reloadKey) !== "1";

        if (shouldReload) {
          window.sessionStorage.setItem(reloadKey, "1");
          window.location.reload();
          return;
        }

        if (!hadController && !hadRegistrations) {
          window.sessionStorage.removeItem(reloadKey);
        }
      } catch (error) {
        console.error("[sw] cleanup failed", error);
      }
    };

    void unregisterAllServiceWorkers();
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
          <p className="text-sm font-semibold tracking-tight">A new version of Digital Polyglot is available.</p>
          <p className="text-xs text-blue-100/80">Refresh to load the latest updates.</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
        >
          Refresh
        </button>
      </div>
    </div>
  ) : null;
}
