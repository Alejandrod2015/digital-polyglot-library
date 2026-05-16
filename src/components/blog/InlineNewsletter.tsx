"use client";

// Inline newsletter capture inserted mid-article. Industry data (HubSpot,
// Substack) consistently shows mid-post forms convert 3-5x better than the
// footer-only equivalent. Submits to the same endpoint the bottom-of-page
// form uses so we don't fork the funnel.

import { useState, type FormEvent } from "react";

export default function InlineNewsletter() {
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [email, setEmail] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    try {
      await fetch("https://shop.digitalpolyglot.com/newsletter", {
        method: "POST",
        body: new URLSearchParams({ email }),
        mode: "no-cors",
      });
      setStatus("ok");
      setEmail("");
    } catch {
      setStatus("err");
    }
  }

  return (
    <aside
      style={{
        margin: "32px 0",
        padding: "22px 24px",
        border: "1px solid rgba(252, 211, 77, 0.30)",
        borderRadius: 18,
        background:
          "radial-gradient(ellipse 60% 100% at 0% 50%, rgba(252, 211, 77, 0.10) 0%, transparent 70%), rgba(255, 255, 255, 0.02)",
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 900,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "#fcd34d",
          marginBottom: 8,
        }}
      >
        Newsletter
      </div>
      <h3
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          color: "#fff",
          lineHeight: 1.2,
        }}
      >
        Liked this? Get the next one in your inbox.
      </h3>
      <p
        style={{
          margin: "8px 0 14px",
          fontSize: 14,
          color: "rgba(255,255,255,0.65)",
          lineHeight: 1.5,
        }}
      >
        A new word, a story excerpt, and what we&apos;re reading. Twice a month, no drip.
      </p>
      {status === "ok" ? (
        <p style={{ margin: 0, color: "#fcd34d", fontWeight: 800 }}>
          Subscribed. Talk soon.
        </p>
      ) : (
        <form
          onSubmit={onSubmit}
          style={{
            display: "flex",
            gap: 8,
            padding: 6,
            background: "rgba(5, 24, 52, 0.55)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 12,
            maxWidth: 460,
          }}
        >
          <input
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              padding: "10px 12px",
              color: "#fff",
              font: "inherit",
              fontWeight: 700,
            }}
          />
          <button
            type="submit"
            style={{
              background: "#fcd34d",
              color: "#051834",
              border: "none",
              padding: "10px 16px",
              borderRadius: 10,
              fontWeight: 900,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Subscribe
          </button>
        </form>
      )}
      {status === "err" && (
        <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
          Couldn&apos;t reach the server. Try again in a moment.
        </p>
      )}
    </aside>
  );
}
