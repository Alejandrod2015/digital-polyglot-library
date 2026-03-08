"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  X,
  ArrowLeft,
  MessageSquare,
  Settings,
  ChartNoAxesColumn,
  BookMarked,
  Crown,
  LogIn,
  LogOut,
} from "lucide-react";
import { SignedIn, SignedOut, SignOutButton, useUser } from "@clerk/nextjs";
import * as Sentry from "@sentry/nextjs";

type Plan = "free" | "basic" | "premium" | "polyglot";

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const plan = (user?.publicMetadata?.plan as Plan | undefined) ?? "free";

  const trackUpgradeCta = async (source: string) => {
    try {
      await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storySlug: `__upgrade_${source}__`,
          bookSlug: "__plans__",
          eventType: "upgrade_cta_clicked",
        }),
      });
    } catch {
      // noop
    }
  };

  const isBookStoryPage = /^\/books\/[^/]+\/[^/]+$/.test(pathname || "");
  const isPolyglotStoryPage = /^\/stories\/[^/]+$/.test(pathname || "");
  const isStoryPage = isBookStoryPage || isPolyglotStoryPage;
  const isBookPage = /^\/books\/[^/]+$/.test(pathname || "");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const handleFeedback = (): void => {
    const eventId =
      Sentry.lastEventId() ||
      Sentry.captureException(new Error("User feedback (mobile menu)"));

    const sentryRuntime = Sentry as unknown as {
      showReportDialog?: (options?: Record<string, unknown>) => void;
    };

    if (typeof sentryRuntime.showReportDialog === "function") {
      sentryRuntime.showReportDialog({ eventId });
      return;
    }

    alert("Feedback module not ready. Please reload and try again.");
  };

  if (isStoryPage) {
    return null;
  }

  if (isBookPage) {
    const { getLastSection } = require("@/lib/navigationMemory");
    const destinations: Record<string, string> = {
      home: "/",
      "my-library": "/my-library",
      favorites: "/favorites",
      explore: "/explore",
      settings: "/settings",
    };
    const last = getLastSection();
    const target = destinations[last || "home"];

    return (
      <div className="fixed top-0 left-0 z-30 p-4 md:hidden">
        <button
          onClick={() => router.push(target)}
          className="text-[var(--foreground)]"
        >
          <ArrowLeft size={28} />
        </button>
      </div>
    );
  }

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        className="p-4 text-[var(--foreground)] fixed top-0 right-0 z-30"
      >
        <Menu size={28} />
      </button>

      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/50 z-20" />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-64 bg-[var(--nav-bg)] text-[var(--foreground)] z-30 transform transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-[var(--foreground)]"
        >
          <X size={28} />
        </button>

        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto px-6 pt-16">
            <nav className="flex flex-col gap-5 text-base">
              <SignedIn>
                <Link
                  href="/progress"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-3 text-[var(--nav-text-muted)] hover:text-[var(--nav-text)]"
                >
                  <ChartNoAxesColumn size={20} />
                  Progress
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-3 text-[var(--nav-text-muted)] hover:text-[var(--nav-text)]"
                >
                  <Settings size={20} />
                  Settings
                </Link>

                {plan === "free" && (
                  <Link
                    href="/story-of-the-week"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-3 text-[var(--nav-text-muted)] hover:text-[var(--nav-text)]"
                  >
                    <BookMarked size={20} />
                    Story of the Week
                  </Link>
                )}

                {plan === "basic" && (
                  <Link
                    href="/story-of-the-day"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-3 text-[var(--nav-text-muted)] hover:text-[var(--nav-text)]"
                  >
                    <BookMarked size={20} />
                    Story of the Day
                  </Link>
                )}

                {(plan === "free" || plan === "basic") && (
                  <Link
                    href="/plans"
                    onClick={() => {
                      void trackUpgradeCta("mobile_menu");
                      setOpen(false);
                    }}
                    className="inline-flex items-center gap-3 text-amber-300 hover:text-amber-200"
                  >
                    <Crown size={20} />
                    Upgrade
                  </Link>
                )}

                <SignOutButton>
                  <button
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-3 text-[var(--nav-text-muted)] hover:text-[var(--nav-text)] text-left"
                  >
                    <LogOut size={20} />
                    Sign out
                  </button>
                </SignOutButton>
              </SignedIn>

              <SignedOut>
                <Link
                  href={`/sign-in?redirect_url=${encodeURIComponent(
                    pathname && pathname !== "/auth/post-login" ? pathname : "/"
                  )}`}
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-3 text-[var(--nav-text-muted)] hover:text-[var(--nav-text)]"
                >
                  <LogIn size={20} />
                  Sign in
                </Link>
              </SignedOut>
            </nav>
          </div>

          <div className="mt-auto border-t border-[var(--nav-border)] px-6 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4">
            <div className="rounded-2xl border border-[var(--nav-border)] bg-white/[0.03] px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--nav-text-muted)]/70">
                Legal
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] text-[var(--nav-text-muted)]/85">
                <Link href="/impressum" onClick={() => setOpen(false)} className="hover:text-[var(--nav-text)]">
                  Impressum
                </Link>
                <Link href="/privacy" onClick={() => setOpen(false)} className="hover:text-[var(--nav-text)]">
                  Privacy
                </Link>
                <Link href="/cookies" onClick={() => setOpen(false)} className="hover:text-[var(--nav-text)]">
                  Cookies
                </Link>
                <Link href="/terms" onClick={() => setOpen(false)} className="hover:text-[var(--nav-text)]">
                  Terms
                </Link>
                <Link
                  href="/data-deletion"
                  onClick={() => setOpen(false)}
                  className="col-span-2 hover:text-[var(--nav-text)]"
                >
                  Data deletion
                </Link>
              </div>
            </div>

            <button
              onClick={handleFeedback}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 text-[var(--nav-text-muted)] hover:text-[var(--nav-text)] transition"
            >
              <MessageSquare size={22} />
              <span>Feedback</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
