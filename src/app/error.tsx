"use client";

// Route-level boundary. Anything thrown while rendering a page (server or
// client) lands here instead of killing the whole document, so the sidebar and
// the tab bar stay usable and the user can retry without a full reload.
//
// It also REPORTS: an error caught by a React boundary is not an unhandled
// error, so Sentry only sees it because of the `captureException` below. Until
// 2026-08-20 nothing in the app did this, and a crash after signing in left no
// trace anywhere except the user's own console.
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-extrabold text-[var(--foreground)]">
        Something broke while loading this page
      </h1>
      <p className="text-sm opacity-70">
        The page failed to load. Try again; if it keeps happening, send us the
        details below.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-blue-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-blue-400"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold"
        >
          Go home
        </Link>
      </div>
      <details className="w-full text-left">
        <summary className="cursor-pointer text-xs opacity-60">Error details</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-black/10 p-3 text-xs opacity-80">
          {error.name}: {error.message}
          {error.digest ? `\ndigest: ${error.digest}` : ""}
        </pre>
      </details>
    </div>
  );
}
