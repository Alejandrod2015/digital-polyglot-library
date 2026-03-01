"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  X,
  ChevronDown,
  ArrowLeft,
  MessageSquare,
  Settings,
  BookMarked,
  CreditCard,
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

  const isStoryPage = /^\/books\/[^/]+\/[^/]+$/.test(pathname || "");
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
    const bookSlug = pathname?.split("/")[2];
    return (
      <div className="fixed top-0 left-0 z-30 p-4 md:hidden">
        <Link href={`/books/${bookSlug}`} className="text-white">
          <ChevronDown size={28} />
        </Link>
      </div>
    );
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
          className="text-white"
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
        className="p-4 text-white fixed top-0 right-0 z-30"
      >
        <Menu size={28} />
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
        />
      )}

      <div
        className={`fixed top-0 right-0 h-full w-64 bg-[var(--bg-sidebar)] z-30 transform transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-white"
        >
          <X size={28} />
        </button>

        <div className="flex flex-col h-full justify-between">
          <div className="pt-16 px-6">
            <nav className="flex flex-col gap-5 text-base">
              <SignedIn>
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-3 text-gray-200 hover:text-white"
                >
                  <Settings size={20} />
                  Settings
                </Link>

                {plan === "free" && (
                  <Link
                    href="/story-of-the-week"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-3 text-gray-200 hover:text-white"
                  >
                    <BookMarked size={20} />
                    Story of the Week
                  </Link>
                )}

                {plan === "basic" && (
                  <Link
                    href="/story-of-the-day"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-3 text-gray-200 hover:text-white"
                  >
                    <BookMarked size={20} />
                    Story of the Day
                  </Link>
                )}

                {(plan === "free" || plan === "basic") && (
                  <Link
                    href="/plans"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-3 text-gray-200 hover:text-white"
                  >
                    <CreditCard size={20} />
                    Upgrade
                  </Link>
                )}

                <SignOutButton>
                  <button
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-3 text-gray-200 hover:text-white text-left"
                  >
                    <LogOut size={20} />
                    Sign out
                  </button>
                </SignOutButton>
              </SignedIn>

              <SignedOut>
                <Link
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-3 text-gray-200 hover:text-white"
                >
                  <LogIn size={20} />
                  Sign in
                </Link>
              </SignedOut>
            </nav>
          </div>

          {/* Centered Feedback button */}
          <div className="border-t border-gray-700 py-4 px-6 space-y-4">
            <button
              onClick={handleFeedback}
              className="w-full inline-flex items-center justify-center gap-2 text-gray-300 hover:text-white transition"
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
