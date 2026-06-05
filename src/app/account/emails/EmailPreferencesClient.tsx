"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Preference = {
  email: string;
  progress: boolean;
  reminders: boolean;
  unsubscribedAll: boolean;
};

const CATEGORIES: { key: "progress" | "reminders"; title: string; description: string }[] = [
  {
    key: "progress",
    title: "Progress & milestones",
    description: "When you finish a story, your weekly recap, and reading milestones.",
  },
  {
    key: "reminders",
    title: "Reminders",
    description: "Nudges to pick up a story you started, and check-ins if you've been away.",
  },
];

const C = {
  navy: "#051834",
  screen: "#07203f",
  line: "rgba(125,211,252,0.16)",
  fg: "#eef4fc",
  fgSoft: "#c2d2e8",
  muted: "#8aa0be",
  faint: "#54708f",
  gold: "#fcd34d",
  sky: "#7dd3fc",
};

export default function EmailPreferencesClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [pref, setPref] = useState<Preference | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error" | "unauthorized">(
    "loading"
  );

  const load = useCallback(async () => {
    setStatus("loading");
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`/api/email/preferences${qs}`);
    if (res.status === 401) {
      setStatus("unauthorized");
      return;
    }
    if (!res.ok) {
      setStatus("error");
      return;
    }
    const data = await res.json();
    setPref(data.preference);
    setStatus("ready");
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (patch: Partial<Preference>) => {
      if (!pref) return;
      const optimistic = { ...pref, ...patch };
      setPref(optimistic);
      setStatus("saving");
      const res = await fetch(`/api/email/preferences`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...patch, token }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = await res.json();
      setPref(data.preference);
      setStatus("ready");
    },
    [pref, token]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.navy,
        color: C.fg,
        fontFamily: "'Nunito',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "48px 20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 8 }}>
          Email preferences
        </h1>
        <p style={{ fontSize: 16, fontWeight: 600, color: C.fgSoft, marginBottom: 28 }}>
          {pref?.email
            ? `Choose what we send to ${pref.email}.`
            : "Choose which Digital Polyglot emails you'd like to get."}
        </p>

        {status === "loading" && <p style={{ color: C.muted }}>Loading…</p>}

        {status === "unauthorized" && (
          <div style={cardStyle}>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.fgSoft }}>
              Open this page from a link in one of your emails, or sign in to manage your
              preferences.
            </p>
            <a href="/sign-in?redirect_url=/account/emails" style={{ ...ctaStyle, marginTop: 18 }}>
              Sign in
            </a>
          </div>
        )}

        {status === "error" && (
          <div style={cardStyle}>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.fgSoft }}>
              Something went wrong. Please try again.
            </p>
            <button onClick={load} style={{ ...ctaStyle, marginTop: 18, border: "none", cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}

        {pref && (status === "ready" || status === "saving") && (
          <>
            <div style={{ opacity: pref.unsubscribedAll ? 0.45 : 1, transition: "opacity .15s" }}>
              {CATEGORIES.map((cat) => (
                <Row
                  key={cat.key}
                  title={cat.title}
                  description={cat.description}
                  checked={pref[cat.key]}
                  disabled={pref.unsubscribedAll}
                  onChange={(v) => save({ [cat.key]: v } as Partial<Preference>)}
                />
              ))}
            </div>

            <div
              style={{
                marginTop: 22,
                paddingTop: 22,
                borderTop: `1px solid ${C.line}`,
              }}
            >
              <Row
                title="Unsubscribe from all"
                description="Stop all lifecycle emails. You'll still get important account emails."
                checked={pref.unsubscribedAll}
                tone="danger"
                onChange={(v) => save({ unsubscribedAll: v })}
              />
            </div>

            <p style={{ marginTop: 24, fontSize: 13, fontWeight: 700, color: C.faint, height: 18 }}>
              {status === "saving" ? "Saving…" : "Saved automatically."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: C.screen,
  border: `1px solid ${C.line}`,
  borderRadius: 16,
  padding: 24,
  textAlign: "center",
};

const ctaStyle: React.CSSProperties = {
  display: "inline-block",
  background: C.gold,
  color: "#000",
  fontWeight: 900,
  fontSize: 15,
  textDecoration: "none",
  padding: "13px 26px",
  borderRadius: 12,
};

function Row({
  title,
  description,
  checked,
  disabled,
  tone = "normal",
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  tone?: "normal" | "danger";
  onChange: (v: boolean) => void;
}) {
  const on = checked && !disabled;
  const accent = tone === "danger" ? "#ef6b6b" : C.sky;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 16,
        background: C.screen,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        padding: "18px 20px",
        marginBottom: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.fg, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.muted, lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0,
          width: 50,
          height: 30,
          borderRadius: 999,
          border: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          background: checked ? accent : "rgba(125,211,252,0.18)",
          position: "relative",
          transition: "background .15s",
          padding: 0,
          marginTop: 2,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 23 : 3,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#fff",
            transition: "left .15s",
            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          }}
        />
      </button>
    </div>
  );
}
