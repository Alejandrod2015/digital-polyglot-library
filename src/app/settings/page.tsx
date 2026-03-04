"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";

type LanguageOption = { code: string; name: string };
type Plan = "free" | "basic" | "premium" | "polyglot" | "owner" | undefined;
type SaveStatus = "idle" | "saving" | "saved" | "error";
type ThemePref = "system" | "dark" | "light";

const LANGUAGES: LanguageOption[] = [
  { code: "English", name: "English" },
  { code: "Spanish", name: "Spanish" },
  { code: "French", name: "French" },
  { code: "German", name: "German" },
  { code: "Italian", name: "Italian" },
  { code: "Portuguese", name: "Portuguese" },
  { code: "Japanese", name: "Japanese" },
  { code: "Korean", name: "Korean" },
  { code: "Chinese", name: "Chinese" },
];

const MAX_SELECTION = 3;
const THEME_KEY = "dp_theme_pref";

function toStringArray(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
}

function normalizeSelection(items: string[]): string[] {
  return Array.from(new Set(items.map((x) => x.trim()).filter(Boolean)));
}

function equalsSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((item) => bSet.has(item));
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const [selected, setSelected] = useState<string[]>([]);
  const [persisted, setPersisted] = useState<string[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [hint, setHint] = useState("");
  const [themePref, setThemePref] = useState<ThemePref>("system");

  const plan = (user?.publicMetadata?.plan as Plan) ?? "free";
  const isFree = plan === "free";

  const dirty = useMemo(() => !equalsSet(selected, persisted), [selected, persisted]);

  useEffect(() => {
    if (!isLoaded) return;
    const current = normalizeSelection(toStringArray(user?.publicMetadata?.targetLanguages));
    setSelected(current);
    setPersisted(current);
    setStatus("idle");
    setHint("");
  }, [isLoaded, user]);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") {
      setThemePref(stored);
      return;
    }
    setThemePref("system");
  }, []);

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(""), 2800);
    return () => window.clearTimeout(timer);
  }, [hint]);

  const savePreferences = async () => {
    if (isFree || !dirty) return;

    try {
      setStatus("saving");
      const payload = normalizeSelection(selected).slice(0, MAX_SELECTION);
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguages: payload }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data: unknown = await res.json();
      const serverTL = normalizeSelection(
        toStringArray((data as Record<string, unknown>)?.targetLanguages)
      );
      setSelected(serverTL);
      setPersisted(serverTL);
      setStatus("saved");
      await user?.reload();
    } catch (err) {
      console.error(err);
      setStatus("error");
      setHint("Could not save. Please try again.");
    }
  };

  useEffect(() => {
    if (isFree || !dirty) return;
    const timer = window.setTimeout(() => {
      void savePreferences();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [dirty, selected, isFree]);

  const toggleLanguage = (code: string) => {
    if (isFree) {
      setHint("Upgrade to save language preferences.");
      return;
    }

    setSelected((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= MAX_SELECTION) {
        setHint(`You can select up to ${MAX_SELECTION} languages.`);
        return prev;
      }
      return [...prev, code];
    });
    if (status === "saved") setStatus("idle");
  };

  const setTheme = (next: ThemePref) => {
    setThemePref(next);
    localStorage.setItem(THEME_KEY, next);

    const root = document.documentElement;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (next === "system") {
      root.removeAttribute("data-theme");
      if (metaTheme) metaTheme.setAttribute("content", systemDark ? "#0b1e36" : "#eef3fb");
    } else {
      root.setAttribute("data-theme", next);
      if (metaTheme) metaTheme.setAttribute("content", next === "dark" ? "#0b1e36" : "#eef3fb");
    }

    window.dispatchEvent(new Event("dp-theme-change"));
    setHint("Theme updated.");
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen text-[var(--foreground)] p-6">
        <div className="h-8 w-52 rounded bg-[var(--card-bg)] animate-pulse mb-5" />
        <div className="h-4 w-80 rounded bg-[var(--card-bg)] animate-pulse mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-11 rounded-xl bg-[var(--card-bg)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[var(--foreground)] p-6 pb-24">
      <h1 className="text-2xl font-semibold mb-2">Language Preferences</h1>
      <p className="text-[var(--muted)] mb-5 text-sm">
        We use this to personalize Home, Explore, and recommendations.
      </p>

      {isFree ? (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-400/15 p-4 text-sm text-[var(--foreground)]">
          <p className="mb-3">
            You are on <span className="font-semibold">Free</span>. Language personalization is
            available on paid plans.
          </p>
          <Link
            href="/plans"
            className="inline-flex rounded-lg bg-amber-400/90 px-3 py-1.5 text-[13px] font-semibold text-[#1b1b1b] hover:bg-amber-300 transition-colors"
          >
            Upgrade plan
          </Link>
        </div>
      ) : null}

      <section className="mb-6">
        <h2 className="text-sm uppercase tracking-[0.08em] text-[var(--muted)] mb-3">Appearance</h2>
        <div className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-1">
          {(["system", "dark", "light"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTheme(mode)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                themePref === mode
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--foreground)]/85 hover:bg-[var(--card-bg-hover)]"
              }`}
            >
              {mode === "system" ? "System" : mode === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </div>
      </section>

      <p className="mb-3 text-xs text-[var(--muted)]">
        Selected: {selected.length}/{MAX_SELECTION}
      </p>

      <section>
        <h2 className="text-sm uppercase tracking-[0.08em] text-[var(--muted)] mb-3">Languages</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {LANGUAGES.map((lang) => {
            const active = selected.includes(lang.code);
            return (
              <button
                key={lang.code}
                onClick={() => toggleLanguage(lang.code)}
                className={`rounded-xl px-4 py-2.5 font-medium border transition-colors text-left ${
                  active
                    ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                    : "bg-[var(--card-bg)] border-[var(--card-border)] hover:bg-[var(--card-bg-hover)] text-[var(--foreground)]"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className={`inline-flex h-4 w-4 rounded-full border text-[10px] items-center justify-center ${
                      active ? "border-white/70 bg-white/15" : "border-[var(--chip-border)]"
                    }`}
                  >
                    {active ? "✓" : ""}
                  </span>
                  {lang.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="sticky bottom-[4.75rem] mt-6">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)]/95 backdrop-blur px-4 py-2 text-sm text-[var(--foreground)]/90">
          {status === "saving" ? "Saving changes..." : null}
          {status === "saved" ? "Saved" : null}
          {status === "error" ? "Could not save" : null}
          {status === "idle" && dirty ? "Unsaved changes" : null}
          {status === "idle" && !dirty ? "Preferences are up to date" : null}
          {hint ? <span className="ml-2 text-amber-200">{hint}</span> : null}
        </div>
      </div>
    </div>
  );
}
