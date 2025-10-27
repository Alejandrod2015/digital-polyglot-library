"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, ChevronDown, ArrowLeft, MessageSquare } from "lucide-react";
import Sidebar from "./Sidebar";
import * as Sentry from "@sentry/nextjs";

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
          onClick={() => (window.location.href = target)}
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
        className="p-4 text-white fixed top-0 left-0 z-30"
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
        className={`fixed top-0 left-0 h-full w-64 bg-[#0B132B] z-30 transform transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-white"
        >
          <X size={28} />
        </button>

        <div className="flex flex-col h-full justify-between">
          <div className="pt-12">
            <Sidebar />
          </div>

          {/* Centered Feedback button */}
          <div className="border-t border-gray-700 py-4">
            <button
              onClick={handleFeedback}
              className="mx-auto flex items-center gap-2 text-gray-300 hover:text-white transition"
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
