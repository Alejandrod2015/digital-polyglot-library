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
const MAX_INTERESTS = 12;
const THEME_KEY = "dp_theme_pref";
const SUGGESTED_INTERESTS = [
  "Coffee",
  "Sustainability",
  "Food",
  "Travel",
  "Business",
  "Technology",
  "Health",
  "Art",
  "Nature",
  "History",
  "Music",
  "Sports",
];

function toStringArray(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
}

function normalizeSelection(items: string[]): string[] {
  return Array.from(new Set(items.map((x) => x.trim()).filter(Boolean)));
}

function normalizeInterests(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const cleaned = item.trim().replace(/\s+/g, " ");
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
}

function equalsSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((item) => bSet.has(item));
}

function formatPlanLabel(plan: Plan): string {
  switch (plan) {
    case "basic":
      return "Basic";
    case "premium":
      return "Premium";
    case "polyglot":
      return "Polyglot";
    case "owner":
      return "Owner";
    case "free":
    default:
      return "Free";
  }
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const [selected, setSelected] = useState<string[]>([]);
  const [persisted, setPersisted] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [persistedInterests, setPersistedInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [hint, setHint] = useState("");
  const [themePref, setThemePref] = useState<ThemePref>("system");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");

  const plan = (user?.publicMetadata?.plan as Plan) ?? "free";
  const isFree = plan === "free";
  const hasPaidPlan = plan === "premium" || plan === "polyglot" || plan === "owner";
  const planLabel = formatPlanLabel(plan);

  const dirty = useMemo(
    () => !equalsSet(selected, persisted) || !equalsSet(interests, persistedInterests),
    [selected, persisted, interests, persistedInterests]
  );

  useEffect(() => {
    if (!isLoaded) return;
    const current = normalizeSelection(toStringArray(user?.publicMetadata?.targetLanguages));
    const currentInterests = normalizeInterests(toStringArray(user?.publicMetadata?.interests));
    setSelected(current);
    setPersisted(current);
    setInterests(currentInterests);
    setPersistedInterests(currentInterests);
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
      const payloadInterests = normalizeInterests(interests);
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguages: payload, interests: payloadInterests }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data: unknown = await res.json();
      const record = data as Record<string, unknown>;
      const serverTL = normalizeSelection(
        toStringArray(record?.targetLanguages)
      );
      const serverInterests = normalizeInterests(
        toStringArray(record?.interests)
      );
      setSelected(serverTL);
      setPersisted(serverTL);
      setInterests(serverInterests);
      setPersistedInterests(serverInterests);
      setStatus("saved");
      await user?.reload();
    } catch (err) {
      console.error(err);
      setStatus("error");
      setHint("Could not save. Please try again.");
    }
  };

  const toggleInterest = (value: string) => {
    const nextValue = value.trim().replace(/\s+/g, " ");
    if (!nextValue) return;
    setInterests((prev) => {
      const current = normalizeInterests(prev);
      const has = current.some((item) => item.toLowerCase() === nextValue.toLowerCase());
      if (has) return current.filter((item) => item.toLowerCase() !== nextValue.toLowerCase());
      if (current.length >= MAX_INTERESTS) {
        setHint(`You can select up to ${MAX_INTERESTS} interests.`);
        return current;
      }
      return normalizeInterests([...current, nextValue]);
    });
    if (status === "saved") setStatus("idle");
  };

  const addCustomInterest = () => {
    const nextValue = interestInput.trim().replace(/\s+/g, " ");
    if (!nextValue) return;
    toggleInterest(nextValue);
    setInterestInput("");
  };

  useEffect(() => {
    if (isFree || !dirty) return;
    const timer = window.setTimeout(() => {
      void savePreferences();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [dirty, selected, interests, isFree]);

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

  const openBillingPortal = async () => {
    try {
      setBillingLoading(true);
      setBillingError("");
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string; fallbackUrl?: string };
      if (!res.ok || !data.url) {
        if (data.fallbackUrl) {
          window.location.href = data.fallbackUrl;
          return;
        }
        throw new Error(data.error || "Could not open billing portal.");
      }
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      setBillingError(err instanceof Error ? err.message : "Could not open billing portal.");
    } finally {
      setBillingLoading(false);
    }
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
      <h1 className="text-2xl font-semibold mb-2">Settings</h1>
      <p className="text-[var(--muted)] mb-5 text-sm">
        We use this to personalize Home, Explore, and recommendations.
      </p>

      <section className="mb-6 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-sm text-[var(--foreground)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm uppercase tracking-[0.08em] text-[var(--muted)]">Billing</h2>
            <p className="mt-2 text-base font-semibold">Current plan: {planLabel}</p>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              Manage your plan from here. Free users can review available options. Paid users can
              update their plan, payment method, or cancellation settings in Stripe Billing.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {hasPaidPlan ? (
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={billingLoading}
              className="inline-flex rounded-lg bg-[var(--primary)] px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 transition disabled:opacity-60"
            >
              {billingLoading ? "Opening..." : "Manage billing"}
            </button>
          ) : (
            <Link
              href="/plans"
              className="inline-flex rounded-lg bg-amber-400/90 px-3 py-1.5 text-[13px] font-semibold text-[#1b1b1b] hover:bg-amber-300 transition-colors"
            >
              See plans
            </Link>
          )}
          {billingError ? <span className="text-[13px] text-amber-300">{billingError}</span> : null}
        </div>

        {isFree ? (
          <p className="mt-3 text-xs text-[var(--muted)]">
            Language personalization and the full reading experience are available on paid plans.
          </p>
        ) : null}
      </section>

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

      <section className="mt-7">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm uppercase tracking-[0.08em] text-[var(--muted)]">Interests</h2>
          <span className="text-xs text-[var(--muted)]">
            {interests.length}/{MAX_INTERESTS}
          </span>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTED_INTERESTS.map((interest) => {
            const active = interests.some((item) => item.toLowerCase() === interest.toLowerCase());
            return (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                    : "bg-[var(--chip-bg)] border-[var(--chip-border)] text-[var(--chip-text)] hover:bg-[var(--card-bg-hover)]"
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>
        <div className="mb-3 flex items-center gap-2">
          <input
            value={interestInput}
            onChange={(e) => setInterestInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomInterest();
              }
            }}
            placeholder="Add custom interest (e.g. urbanism)"
            className="flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          />
          <button
            type="button"
            onClick={addCustomInterest}
            className="rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Add
          </button>
        </div>
        {interests.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className="rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-3 py-1 text-sm text-[var(--chip-text)] hover:bg-[var(--card-bg-hover)]"
                title="Remove interest"
              >
                {interest} ×
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No interests selected yet.</p>
        )}
      </section>

      <div className="sticky bottom-[4.75rem] mt-6">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)]/95 backdrop-blur px-4 py-2 text-sm text-[var(--foreground)]/90">
          {status === "saving" ? "Saving changes..." : null}
          {status === "saved" ? "Saved" : null}
          {status === "error" ? "Could not save" : null}
          {status === "idle" && dirty ? "Unsaved changes" : null}
          {status === "idle" && !dirty ? "Settings are up to date" : null}
          {hint ? (
            <span className="ml-2 font-medium text-[var(--primary)]">
              {hint}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
