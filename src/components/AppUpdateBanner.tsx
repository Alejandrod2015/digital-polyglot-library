"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  currentVersion: string;
  enabled?: boolean;
};

type VersionPayload = {
  version?: string;
};

const POLL_INTERVAL_MS = 60_000;

export default function AppUpdateBanner({ currentVersion, enabled = true }: Props) {
  const [nextVersion, setNextVersion] = useState<string | null>(null);
  const checkingRef = useRef(false);

  const shouldRun = useMemo(() => {
    if (!enabled) return false;
    if (!currentVersion || currentVersion === "dev-local") return false;
    return true;
  }, [currentVersion, enabled]);

  const checkForUpdate = useCallback(async () => {
    if (!shouldRun || checkingRef.current) return;
    checkingRef.current = true;

    try {
      const response = await fetch("/api/version", {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
        },
      });
      if (!response.ok) return;
      const payload = (await response.json()) as VersionPayload;
      const latestVersion = typeof payload.version === "string" ? payload.version.trim() : "";
      if (!latestVersion || latestVersion === currentVersion) return;
      setNextVersion(latestVersion);
    } catch {
      // Keep the app quiet if the version check fails.
    } finally {
      checkingRef.current = false;
    }
  }, [currentVersion, shouldRun]);

  useEffect(() => {
    if (!shouldRun) return;

    const intervalId = window.setInterval(() => {
      void checkForUpdate();
    }, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };

    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkForUpdate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkForUpdate, shouldRun]);

  if (!nextVersion) return null;

  return (
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
  );
}
