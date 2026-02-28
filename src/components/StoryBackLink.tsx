"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type StoryBackLinkProps = {
  bookSlug: string;
};

type BackConfig = {
  href: string;
  label: string;
};

function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export default function StoryBackLink({ bookSlug }: StoryBackLinkProps) {
  const searchParams = useSearchParams();

  const back = useMemo<BackConfig>(() => {
    const returnTo = searchParams.get("returnTo");
    const returnLabel = searchParams.get("returnLabel");
    const from = searchParams.get("from");

    if (returnTo && isSafeInternalPath(returnTo)) {
      return {
        href: returnTo,
        label: returnLabel?.trim() ? `Back to ${returnLabel.trim()}` : "Back",
      };
    }

    if (from === "my-library") {
      return { href: "/my-library", label: "Back to My Library" };
    }
    if (from === "explore") {
      return { href: "/explore", label: "Back to Explore" };
    }
    if (from === "favorites") {
      return { href: "/favorites", label: "Back to Favorites" };
    }
    if (from === "home") {
      return { href: "/", label: "Back to Home" };
    }

    return { href: `/books/${bookSlug}`, label: "Back to book" };
  }, [bookSlug, searchParams]);

  return (
    <Link
      href={back.href}
      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-gray-700"
    >
      <ArrowLeft className="h-5 w-5" />
      <span>{back.label}</span>
    </Link>
  );
}
