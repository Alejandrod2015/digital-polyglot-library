"use client";

// Last-resort boundary: catches anything the route-level `error.tsx` cannot
// (errors thrown by the root layout itself, and by the providers it mounts).
//
// WHY IT SHOWS THE MESSAGE (2026-08-20): it used to render `NextError` with
// `statusCode={0}`, whose production copy is the bare "Application error: a
// client-side exception has occurred while loading <host> (see the browser
// console for more information)". The user hit exactly that after signing in
// and there was nothing to act on: no stack on screen, no way back, and no
// telemetry either, because an error caught by a React boundary is not an
// unhandled error and Sentry never sees it unless it is reported by hand.
// Now the boundary reports to Sentry and puts the message plus the digest on
// screen, folded away, so a report always carries what broke.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="en">
      <body style={{ margin: 0, background: "#0b1e36", color: "#e6eefc" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            fontFamily:
              "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>
            Something broke while loading this page
          </h1>
          <p style={{ margin: 0, opacity: 0.75, maxWidth: "34rem" }}>
            The page failed to start. Try again; if it keeps happening, send us
            the details below.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                borderRadius: "999px",
                border: "none",
                background: "#3b82f6",
                color: "white",
                fontWeight: 700,
                padding: "0.6rem 1.4rem",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                borderRadius: "999px",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#e6eefc",
                fontWeight: 600,
                padding: "0.6rem 1.4rem",
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
          <details style={{ maxWidth: "40rem", width: "100%", textAlign: "left" }}>
            <summary style={{ cursor: "pointer", opacity: 0.7, fontSize: "0.85rem" }}>
              Error details
            </summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: "0.8rem",
                opacity: 0.85,
                background: "rgba(255,255,255,0.06)",
                borderRadius: "0.75rem",
                padding: "0.75rem",
              }}
            >
              {error.name}: {error.message}
              {error.digest ? `\ndigest: ${error.digest}` : ""}
            </pre>
          </details>
        </main>
      </body>
    </html>
  );
}
