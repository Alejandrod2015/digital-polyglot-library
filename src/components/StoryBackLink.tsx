"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type StoryBackLinkProps = {
  bookSlug?: string;
  fallbackHref?: string;
  fallbackLabel?: string;
};

type BackConfig = {
  href: string;
  label: string;
};

function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

function getLabelFromPath(pathname: string): string {
  if (pathname.startsWith("/explore")) return "Back to Explore";
  if (pathname.startsWith("/my-library")) return "Back to My Library";
  if (pathname.startsWith("/favorites")) return "Back to Favorites";
  if (pathname === "/") return "Back to Home";
  return "Back";
}

export default function StoryBackLink({
  bookSlug,
  fallbackHref,
  fallbackLabel,
}: StoryBackLinkProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const referrerBack = useMemo<BackConfig | null>(() => {
    if (typeof window === "undefined") return null;
    const ref = document.referrer;
    if (!ref) return null;

    try {
      const refUrl = new URL(ref);
      if (refUrl.origin !== window.location.origin) return null;

      const refReturnTo = refUrl.searchParams.get("returnTo");
      const refReturnLabel = refUrl.searchParams.get("returnLabel");
      const refFrom = refUrl.searchParams.get("from");

      if (refReturnTo && isSafeInternalPath(refReturnTo)) {
        return {
          href: refReturnTo,
          label: refReturnLabel?.trim() ? `Back to ${refReturnLabel.trim()}` : "Back",
        };
      }

      if (refFrom === "explore") return { href: "/explore", label: "Back to Explore" };
      if (refFrom === "my-library") return { href: "/my-library", label: "Back to My Library" };
      if (refFrom === "favorites") return { href: "/favorites", label: "Back to Favorites" };
      if (refFrom === "home") return { href: "/", label: "Back to Home" };

      if (
        refUrl.pathname.startsWith("/explore") ||
        refUrl.pathname.startsWith("/my-library") ||
        refUrl.pathname.startsWith("/favorites") ||
        refUrl.pathname === "/"
      ) {
        const full = `${refUrl.pathname}${refUrl.search}`;
        return { href: full, label: getLabelFromPath(refUrl.pathname) };
      }
    } catch {
      return null;
    }

    return null;
  }, []);

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

    if (referrerBack) return referrerBack;

    if (bookSlug) return { href: `/books/${bookSlug}`, label: "Back to book" };
    return {
      href: fallbackHref ?? "/explore",
      label: fallbackLabel ?? "Back to Explore",
    };
  }, [bookSlug, fallbackHref, fallbackLabel, referrerBack, searchParams]);

  const handleBack = () => {
    const returnTo = searchParams.get("returnTo");
    if (returnTo && isSafeInternalPath(returnTo)) {
      router.push(returnTo);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      const ref = document.referrer;
      try {
        if (ref) {
          const refUrl = new URL(ref);
          if (refUrl.origin === window.location.origin) {
            router.back();
            return;
          }
        }
      } catch {
        // ignore parse errors and continue to fallback
      }
    }

    router.push(back.href);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={back.label}
      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white md:text-blue-600 hover:bg-white/10 md:hover:bg-blue-50 hover:text-white md:hover:text-blue-700 dark:md:hover:bg-gray-700"
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="hidden md:inline">{back.label}</span>
    </button>
  );
}
