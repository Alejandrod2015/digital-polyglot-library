"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "dp-install-hint-dismissed";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia("(display-mode: standalone)");
  // iOS Safari pre-PWA-display-mode: navigator.standalone
  const iosStandalone =
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mql.matches || iosStandalone;
}

// Banner that nudges Chrome Android / iOS Safari users to add the
// webapp to their home screen. Sits above the bottom tab bar, only
// shows on mobile, never in standalone/TWA mode, and dismisses once
// (persisted in localStorage). Zero coupling to the service worker:
// works whether SW is enabled or not.
export default function InstallAppHint() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // localStorage blocked: skip silently
      return;
    }
    setPlatform(detectPlatform());
    setShow(true);
  }, []);

  if (!show) return null;

  const onClose = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  const instruction =
    platform === "ios"
      ? "Tap the Share button, then Add to Home Screen."
      : platform === "android"
        ? "Open the browser menu, then tap Install app."
        : "Use your browser menu to install or add this page to your home screen.";

  return (
    <div
      className="md:hidden fixed inset-x-3 z-[45]"
      style={{
        bottom: "calc(4.5rem + env(safe-area-inset-bottom))",
      }}
      role="region"
      aria-label="Install Polyglot to your home screen"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0d2648]/95 px-4 py-3 text-white shadow-2xl backdrop-blur">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-cyan)]/15 text-[var(--color-cyan)]">
          <Share size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-tight">
            Install Polyglot
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-white/70">
            {instruction}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss install hint"
          className="shrink-0 rounded-full p-1 text-white/55 transition hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
