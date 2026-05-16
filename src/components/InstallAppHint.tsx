"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

// Versioned key. Bumping the suffix forces the hint to reappear for
// users who dismissed an earlier iteration (the original copy was
// non-interactive; v2 actually fires the native install dialog).
const DISMISS_KEY = "dp-install-hint-dismissed-v2";

type Platform = "ios" | "android" | "other";

// Chrome / Edge expose this event when the PWA install criteria are
// met. It is not in the standard TypeScript lib yet.
type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
};

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
// shows on mobile, never in standalone/TWA mode, dismisses once
// (persisted in localStorage).
//
// When Chrome fires beforeinstallprompt (no-op SW registered via
// ServiceWorkerBootstrap satisfies the installability criteria), the
// card becomes a tap target that triggers the native install dialog.
// On platforms that never fire that event (iOS Safari, Firefox, etc.)
// the card falls back to a copy explaining how to install manually.
export default function InstallAppHint() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

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

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Preventing default stops the mini-infobar so we can fire the
      // prompt ourselves from the card tap.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setShow(false);
      try {
        window.localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        // ignore
      }
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
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

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShow(false);
        try {
          window.localStorage.setItem(DISMISS_KEY, "1");
        } catch {
          // ignore
        }
      }
    } catch {
      // prompt() throws if called twice; ignore and let the user retry
      // via the browser menu.
    } finally {
      setDeferredPrompt(null);
    }
  };

  const canInstall = !!deferredPrompt;

  const manualInstruction =
    platform === "ios"
      ? "Tap the Share button, then Add to Home Screen."
      : platform === "android"
        ? "Open the browser menu, then tap Install app."
        : "Use your browser menu to install or add this page to your home screen.";

  const subline = canInstall ? "Tap here to install" : manualInstruction;

  const body = (
    <>
      <p className="text-[13.5px] font-semibold leading-tight">
        Install Digital Polyglot
      </p>
      <p className="mt-0.5 text-[11.5px] leading-snug text-white/70">
        {subline}
      </p>
    </>
  );

  return (
    <div
      className="md:hidden fixed inset-x-3 z-[45]"
      style={{
        bottom: "calc(4.5rem + env(safe-area-inset-bottom))",
      }}
      role="region"
      aria-label="Install Digital Polyglot to your home screen"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0d2648]/95 px-4 py-3 text-white shadow-2xl backdrop-blur">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-cyan)]/15 text-[var(--color-cyan)]">
          <Share size={16} />
        </div>
        {canInstall ? (
          <button
            type="button"
            onClick={handleInstall}
            className="min-w-0 flex-1 text-left transition-opacity hover:opacity-90 active:opacity-75"
            aria-label="Install Digital Polyglot"
          >
            {body}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{body}</div>
        )}
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
