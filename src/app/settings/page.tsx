"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useUser } from "@clerk/nextjs";
import { Bell, LifeBuoy, LogOut, Pencil, Zap } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { getCookieConsentKey } from "@/components/CookieConsentBanner";
import { VARIANT_OPTIONS_BY_LANGUAGE, formatVariantLabel } from "@/lib/languageVariant";
import { REMINDER_HOUR_OPTIONS, REMINDER_MINUTE_OPTIONS, formatReminderHour } from "@/lib/reminders";

type LanguageOption = { code: string; name: string };
type Plan = "free" | "basic" | "premium" | "polyglot" | "owner" | undefined;
type BillingSource = "stripe" | "google_play" | "app_store" | null;
type SaveStatus = "idle" | "saving" | "saved" | "error";
type ThemePref = "system" | "dark" | "light";
type SettingsProgressPayload = {
  streakDays: number;
  // Campos usados por el Stats row 4-up del Account tab. Vienen de
  // `/api/progress` (ProgressResponsePayload). Mismas métricas que
  // muestra iPhone bajo `summaryItems`.
  minutesListened?: number;
  storiesFinished?: number;
  booksFinished?: number;
  wordsLearned?: number;
  gamification: {
    totalXp: number;
    todayXp: number;
    weeklyXp: number;
    currentLevel: number;
    levelStartXp: number;
    nextLevelXp: number;
    levelProgress: number;
    dailyStreak: number;
    quests: Array<{
      id: string;
      label: string;
      current: number;
      target: number;
      rewardXp: number;
      complete: boolean;
    }>;
    badges: Array<{
      id: string;
      label: string;
      description: string;
      unlocked: boolean;
      accent: string;
    }>;
  };
};

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

const MAX_INTERESTS = 12;
const THEME_KEY = "dp_theme_pref";
const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"] as const;
const REGION_OPTIONS = [
  "Colombia",
  "Mexico",
  "Argentina",
  "Peru",
  "Germany",
  "France",
  "Brazil",
  "Portugal",
  "Italy",
  "Spain",
] as const;
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
  const [preferredLevel, setPreferredLevel] = useState("");
  const [persistedPreferredLevel, setPersistedPreferredLevel] = useState("");
  const [preferredRegion, setPreferredRegion] = useState("");
  const [persistedPreferredRegion, setPersistedPreferredRegion] = useState("");
  const [preferredVariant, setPreferredVariant] = useState("");
  const [persistedPreferredVariant, setPersistedPreferredVariant] = useState("");
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [persistedRemindersEnabled, setPersistedRemindersEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState<number | "">("");
  const [persistedReminderHour, setPersistedReminderHour] = useState<number | "">("");
  const [reminderMinute, setReminderMinute] = useState<number>(0);
  const [persistedReminderMinute, setPersistedReminderMinute] = useState<number>(0);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [hint, setHint] = useState("");
  const [themePref, setThemePref] = useState<ThemePref>("system");
  const [analyticsConsent, setAnalyticsConsent] = useState<"accepted" | "rejected" | "unset">("unset");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [settingsProgress, setSettingsProgress] = useState<SettingsProgressPayload | null>(null);
  // Tabs paridad con iPhone MobileSettingsScreen: Account /
  // Personalize / Privacy. Cada uno renderiza un subset distinto del
  // panel; el state se inicia en "account" igual que mobile.
  const [activeTab, setActiveTab] = useState<"account" | "personalize" | "privacy">("account");
  // Briefly highlights the Languages section when the user lands on
  // /settings#languages or /settings#languages?add=1 from the mobile
  // language switcher's "See all" / "Add language" buttons. Today the
  // section is a flat toggle grid (no separate "add" modal), so the
  // highlight tells the user where to act for both deep links.
  const [languagesHighlighted, setLanguagesHighlighted] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#languages") return;
    // Defer to next tick so the section is in the DOM and any preceding
    // layout work has settled before we measure / scroll.
    const timer = setTimeout(() => {
      const node = document.getElementById("languages-section");
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setLanguagesHighlighted(true);
    }, 80);
    const fade = setTimeout(() => setLanguagesHighlighted(false), 2400);
    return () => {
      clearTimeout(timer);
      clearTimeout(fade);
    };
  }, []);

  const plan = (user?.publicMetadata?.plan as Plan) ?? "free";
  const hasPaidPlan = plan === "premium" || plan === "polyglot" || plan === "owner";
  const planLabel = formatPlanLabel(plan);
  const billingSource = (user?.publicMetadata?.billingSource as BillingSource | undefined) ?? null;

  const dirty = useMemo(
    () =>
      !equalsSet(selected, persisted) ||
      !equalsSet(interests, persistedInterests) ||
      preferredLevel !== persistedPreferredLevel ||
      preferredRegion !== persistedPreferredRegion ||
      preferredVariant !== persistedPreferredVariant ||
      remindersEnabled !== persistedRemindersEnabled ||
      reminderHour !== persistedReminderHour ||
      reminderMinute !== persistedReminderMinute,
    [
      selected,
      persisted,
      interests,
      persistedInterests,
      preferredLevel,
      persistedPreferredLevel,
      preferredRegion,
      persistedPreferredRegion,
      preferredVariant,
      persistedPreferredVariant,
      remindersEnabled,
      persistedRemindersEnabled,
      reminderHour,
      persistedReminderHour,
      reminderMinute,
      persistedReminderMinute,
    ]
  );

  const primaryLanguage = selected[0] ?? "";
  const availableVariants = useMemo(() => {
    return VARIANT_OPTIONS_BY_LANGUAGE[primaryLanguage.trim().toLowerCase()] ?? [];
  }, [primaryLanguage]);

  // Sync local state from publicMetadata ONLY on the first load. Subsequent
  // `user.reload()` calls (triggered after each save) used to re-run this
  // and clobber freshly-toggled local state, which is why the daily-reminder
  // toggle felt stuck after the first activation.
  const loadedOnceRef = useRef(false);
  useEffect(() => {
    if (!isLoaded) return;
    if (loadedOnceRef.current) return;
    loadedOnceRef.current = true;
    const current = normalizeSelection(toStringArray(user?.publicMetadata?.targetLanguages));
    const currentInterests = normalizeInterests(toStringArray(user?.publicMetadata?.interests));
    const currentLevel =
      typeof user?.publicMetadata?.preferredLevel === "string" ? user.publicMetadata.preferredLevel : "";
    const currentRegion =
      typeof user?.publicMetadata?.preferredRegion === "string" ? user.publicMetadata.preferredRegion : "";
    const currentVariant =
      typeof user?.publicMetadata?.preferredVariant === "string" ? user.publicMetadata.preferredVariant : "";
    const currentRemindersEnabled = user?.publicMetadata?.remindersEnabled === true;
    const currentReminderHour =
      typeof user?.publicMetadata?.reminderHour === "number" ? user.publicMetadata.reminderHour : "";
    const currentReminderMinute =
      typeof user?.publicMetadata?.reminderMinute === "number" ? user.publicMetadata.reminderMinute : 0;
    setSelected(current);
    setPersisted(current);
    setInterests(currentInterests);
    setPersistedInterests(currentInterests);
    setPreferredLevel(currentLevel);
    setPersistedPreferredLevel(currentLevel);
    setPreferredRegion(currentRegion);
    setPersistedPreferredRegion(currentRegion);
    setPreferredVariant(currentVariant);
    setPersistedPreferredVariant(currentVariant);
    setRemindersEnabled(currentRemindersEnabled);
    setPersistedRemindersEnabled(currentRemindersEnabled);
    setReminderHour(currentReminderHour);
    setPersistedReminderHour(currentReminderHour);
    setReminderMinute(currentReminderMinute);
    setPersistedReminderMinute(currentReminderMinute);
    setStatus("idle");
    setHint("");
  }, [isLoaded, user]);

  useEffect(() => {
    if (!availableVariants.some((option) => option.value === preferredVariant)) {
      setPreferredVariant("");
      if (status === "saved") setStatus("idle");
    }
  }, [availableVariants, preferredVariant, status]);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") {
      setThemePref(stored);
      return;
    }
    setThemePref("system");
  }, []);

  useEffect(() => {
    const key = getCookieConsentKey();
    const stored = localStorage.getItem(key);
    if (stored === "accepted" || stored === "rejected") {
      setAnalyticsConsent(stored);
    } else {
      setAnalyticsConsent("unset");
    }
  }, []);

  useEffect(() => {
    if (!hint) return;
    const timer = window.setTimeout(() => setHint(""), 2800);
    return () => window.clearTimeout(timer);
  }, [hint]);

  // Auto-reset del sticky status. Antes "Saved" se quedaba pegado
  // hasta el próximo cambio (el user veía "Saved" indefinidamente
  // tras guardar). Ahora vuelve a idle a los 2.5s. "Saving" no se
  // resetea (es estado transitorio que termina cuando llega la
  // response). "Error" tampoco (el user debe acusar recibo).
  useEffect(() => {
    if (status !== "saved") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    let cancelled = false;

    const loadProgress = async () => {
      if (!user) {
        if (!cancelled) setSettingsProgress(null);
        return;
      }
      try {
        const res = await fetch("/api/progress", { cache: "no-store" });
        const data = (await res.json()) as SettingsProgressPayload & { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load progress");
        if (!cancelled) setSettingsProgress(data);
      } catch {
        if (!cancelled) setSettingsProgress(null);
      }
    };

    if (isLoaded) void loadProgress();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, user]);

  const savePreferences = async () => {
    if (!user) {
      setStatus("error");
      setHint("Sign in to save your preferences.");
      return;
    }
    if (!dirty) return;

    try {
      setStatus("saving");
      const payload = normalizeSelection(selected);
      const payloadInterests = normalizeInterests(interests);
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguages: payload,
          interests: payloadInterests,
          preferredLevel: preferredLevel || null,
          preferredRegion: preferredRegion || null,
          preferredVariant: preferredVariant || null,
          remindersEnabled,
          reminderHour: remindersEnabled && typeof reminderHour === "number" ? reminderHour : null,
          reminderMinute: remindersEnabled && typeof reminderHour === "number" ? reminderMinute : null,
        }),
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
      const serverPreferredLevel =
        typeof record?.preferredLevel === "string" ? record.preferredLevel : "";
      const serverPreferredRegion =
        typeof record?.preferredRegion === "string" ? record.preferredRegion : "";
      const serverPreferredVariant =
        typeof record?.preferredVariant === "string" ? record.preferredVariant : "";
      const serverRemindersEnabled = record?.remindersEnabled === true;
      const serverReminderHour = typeof record?.reminderHour === "number" ? record.reminderHour : "";
      const serverReminderMinute = typeof record?.reminderMinute === "number" ? record.reminderMinute : 0;
      setSelected(serverTL);
      setPersisted(serverTL);
      setInterests(serverInterests);
      setPersistedInterests(serverInterests);
      setPreferredLevel(serverPreferredLevel);
      setPersistedPreferredLevel(serverPreferredLevel);
      setPreferredRegion(serverPreferredRegion);
      setPersistedPreferredRegion(serverPreferredRegion);
      setPreferredVariant(serverPreferredVariant);
      setPersistedPreferredVariant(serverPreferredVariant);
      setRemindersEnabled(serverRemindersEnabled);
      setPersistedRemindersEnabled(serverRemindersEnabled);
      setReminderHour(serverReminderHour);
      setPersistedReminderHour(serverReminderHour);
      setReminderMinute(serverReminderMinute);
      setPersistedReminderMinute(serverReminderMinute);
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
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      void savePreferences();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [dirty, selected, interests, preferredLevel, preferredRegion, preferredVariant, remindersEnabled, reminderHour]);

  const toggleLanguage = (code: string) => {
    setSelected((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      return [...prev, code];
    });
    if (status === "saved") setStatus("idle");
  };

  // "No preference" como toggle del grid: pulsarlo vuelve selected a
  // []. Si después el user elige un idioma, "No preference" se
  // desmarca automáticamente porque selected.length > 0.
  // Semánticamente: 0 idiomas elegidos = todos aplican.
  const noLanguagePreference = selected.length === 0;
  const setNoLanguagePreference = () => {
    setSelected([]);
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

  const updateAnalyticsConsent = (next: "accepted" | "rejected") => {
    const key = getCookieConsentKey();
    localStorage.setItem(key, next);
    window.dispatchEvent(new CustomEvent("dp-cookie-consent", { detail: next }));
    setAnalyticsConsent(next);
    setHint("Cookie preference updated.");
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

  if (!user) {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <h1 className="mb-2 text-2xl font-semibold">Settings</h1>
        <p className="mb-5 text-sm text-[var(--muted)]">
          Sign in to save your language, level, variant, region, and interest preferences.
        </p>
        <Link
          href="/sign-in?redirect_url=/settings"
          className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 pt-8 pb-32 mx-auto text-[var(--foreground)]" style={{ maxWidth: 720 }}>
      {/* ── Hero ── Solo título, como iPhone. Eyebrow + descripción
          se eliminaron: la tab row siguiente contextualiza el panel. */}
      <div className="mb-3">
        <h1 className="text-[28px] font-black tracking-tight text-white leading-none">Settings</h1>
      </div>

      {/* ── Tab row (Account / Personalize / Privacy) ── Pill container
          con segmented buttons. Paridad con MobileSettingsScreen. */}
      <div
        className="mb-4 inline-flex w-full rounded-[18px] p-1 border"
        style={{
          background: "var(--chip-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        {(["account", "personalize", "privacy"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label =
            tab === "account" ? "Account" : tab === "personalize" ? "Personalize" : "Privacy";
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              aria-pressed={isActive}
              className="flex-1 rounded-[14px] py-2.5 text-[13px] font-extrabold transition-colors"
              style={
                isActive
                  ? {
                      background: "var(--card-bg)",
                      color: "var(--color-gold)",
                    }
                  : {
                      background: "transparent",
                      color: "var(--muted)",
                    }
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ─────────────── ACCOUNT TAB ─────────────── */}
      {activeTab === "account" ? (
        <>
      {/* ── iPhone-style user card with level + streak + XP + badges ── */}
      {settingsProgress?.gamification ? (
        <div
          className="mb-3 rounded-[20px] border p-4"
          style={{
            background:
              "linear-gradient(135deg, rgba(252,211,77,0.05) 0%, rgba(125,211,252,0.03) 100%)",
            borderColor: "rgba(252, 211, 77, 0.22)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="grid place-items-center shrink-0 text-[#2a1a02] font-black"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "var(--color-gold)",
                fontSize: 18,
              }}
            >
              {(user?.firstName ?? user?.username ?? "Y").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-extrabold text-white text-[16px] truncate">
                  {user?.firstName?.trim() || user?.username || "You"}
                </p>
                <span className="text-[12px] font-bold text-[var(--color-gold)]">
                  · Level {settingsProgress.gamification.currentLevel}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-white/55">
                {settingsProgress.gamification.totalXp} XP · {settingsProgress.gamification.dailyStreak}-day streak
              </p>
            </div>
            {/* Edit profile (pencil icon ghost) → Clerk user profile.
                Paridad iPhone: el user card siempre lleva un edit
                affordance a la derecha del meta. */}
            <a
              href="/user-profile"
              aria-label="Edit profile"
              className="shrink-0 grid place-items-center transition-colors hover:bg-white/[0.05]"
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--card-border)",
                background: "var(--card-bg)",
                color: "var(--muted)",
              }}
            >
              <Pencil size={14} />
            </a>
          </div>

          <div className="flex items-center justify-between mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em]">
            <span className="text-[#bef264]">
              {settingsProgress.gamification.totalXp - settingsProgress.gamification.levelStartXp} / {settingsProgress.gamification.nextLevelXp - settingsProgress.gamification.levelStartXp} XP
            </span>
            <span className="text-white/45">Next: LV {settingsProgress.gamification.currentLevel + 1}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-white/8">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(settingsProgress.gamification.levelProgress * 100)}%`,
                background: "linear-gradient(90deg, #bef264, #a3e635)",
              }}
            />
          </div>

          {settingsProgress.gamification.badges.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {settingsProgress.gamification.badges.map((badge) => (
                <span
                  key={badge.id}
                  // Locked badges no usan inline white-on-white (que
                  // queda invisible en light). Pasamos a tokens
                  // semánticos así theme switching funciona.
                  className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                    badge.unlocked
                      ? ""
                      : "bg-[var(--chip-bg)] text-[var(--muted)] border border-[var(--chip-border)]"
                  }`}
                  style={
                    badge.unlocked
                      ? { background: "rgba(252,211,77,0.18)", color: "var(--color-gold)", border: "1px solid rgba(252,211,77,0.35)" }
                      : undefined
                  }
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── iPhone-style plan row ── */}
      <div className="mb-6 rounded-[20px] border border-white/8 bg-white/[0.025] p-4 flex items-center gap-3">
        <div
          className="grid place-items-center shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "rgba(252,211,77,0.12)",
          }}
        >
          <Zap size={18} className="text-[var(--color-gold)]" fill="currentColor" strokeWidth={0} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-white text-[15px] capitalize">{planLabel.toLowerCase()} plan</p>
          <p className="text-[12px] text-white/55 truncate">
            {hasPaidPlan
              ? "Creation, reading, favorites and practice are unlocked."
              : "Manage your plan or upgrade for full access."}
          </p>
        </div>
        {hasPaidPlan ? (
          billingSource === "google_play" || billingSource === "app_store" ? (
            <span className="shrink-0 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1.5 text-[12px] font-bold text-white/75">
              {billingSource === "google_play" ? "Google Play" : "App Store"}
            </span>
          ) : (
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={billingLoading}
              className="shrink-0 rounded-full bg-[var(--color-gold)] px-3.5 py-1.5 text-[12px] font-extrabold text-[#2a1a02] hover:brightness-105 disabled:opacity-60"
            >
              {billingLoading ? "Opening…" : "Manage"}
            </button>
          )
        ) : (
          <Link
            href="/plans"
            className="shrink-0 rounded-full bg-[var(--color-gold)] px-3.5 py-1.5 text-[12px] font-extrabold text-[#2a1a02] hover:brightness-105"
          >
            See plans
          </Link>
        )}
      </div>
      {billingError ? (
        <p className="-mt-3 mb-4 text-[12px] text-amber-300">{billingError}</p>
      ) : null}

      {/* ── Stats row 4-up (BOOKS / STORIES / FAVORITES / HOURS) ──
          Paridad con iPhone Account tab. Datos vienen del payload de
          /api/progress (mismo endpoint que mobile consume). Hours =
          minutos/60, "0.9" si <10h, entero si más. */}
      <div className="mb-3 grid grid-cols-4 gap-2">
        {[
          { label: "Books", value: `${settingsProgress?.booksFinished ?? 0}` },
          { label: "Stories", value: `${settingsProgress?.storiesFinished ?? 0}` },
          { label: "Favorites", value: `${settingsProgress?.wordsLearned ?? 0}` },
          {
            label: "Hours",
            value: (() => {
              const minutes = settingsProgress?.minutesListened ?? 0;
              if (minutes <= 0) return "0";
              const hours = minutes / 60;
              return hours >= 10 ? `${Math.round(hours)}` : hours.toFixed(1);
            })(),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-[16px] border border-white/8 bg-white/[0.025] py-3 px-2 text-center min-w-0"
          >
            <p className="text-[20px] font-black text-white leading-none">{stat.value}</p>
            <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/55 truncate">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Footer row (Sign out + Support) ── Paridad iPhone: dos
          botones ghost side-by-side al final del Account tab. */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <SignOutButton>
          <button
            type="button"
            className="rounded-[14px] border border-white/10 bg-white/[0.025] py-3 text-[14px] font-extrabold text-white/85 inline-flex items-center justify-center gap-2 hover:bg-white/[0.05] transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </SignOutButton>
        <a
          href="mailto:support@digitalpolyglot.com?subject=Digital%20Polyglot%20Feedback"
          className="rounded-[14px] border border-white/10 bg-white/[0.025] py-3 text-[14px] font-extrabold text-white/85 inline-flex items-center justify-center gap-2 hover:bg-white/[0.05] transition-colors"
        >
          <LifeBuoy size={16} />
          Support
        </a>
      </div>
        </>
      ) : null}

      {/* ─────────────── PERSONALIZE TAB ─────────────── */}
      {activeTab === "personalize" ? (
        <>
      {/* ── Appearance ── */}
      <div className="mb-3 rounded-[20px] border border-white/8 bg-white/[0.025] p-4">
        <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/55">Appearance</p>
        {/* Antes `bg-black/25` daba el sunken inset en dark pero en
            light se veía como un parche oscuro contra el card cream.
            `var(--chip-bg)` resuelve: rgba blanco 8% en dark, cream
            chip #f1ece0 en light. Misma sensación visual en ambos. */}
        <div
          className="inline-flex rounded-full p-1"
          style={{ background: "var(--chip-bg)" }}
        >
          {(["system", "dark", "light"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTheme(mode)}
              className="px-4 py-1.5 rounded-full text-[13px] font-extrabold transition-colors"
              style={
                themePref === mode
                  ? { background: "var(--color-gold)", color: "var(--color-gold-ink)" }
                  : { background: "transparent", color: "var(--muted)" }
              }
            >
              {mode === "system" ? "System" : mode === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Languages ── */}
      <div
        id="languages-section"
        className={`mb-3 rounded-[20px] border border-white/8 bg-white/[0.025] p-4 transition-shadow duration-500 ${
          languagesHighlighted ? "ring-2 ring-[var(--color-gold)]/50" : ""
        }`}
      >
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/55">Languages</p>
          <span className="text-[12px] font-bold text-white/45">
            {noLanguagePreference ? "All apply" : `${selected.length} selected`}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {/* "No preference" card: misma estructura que las cards de
              idioma, pero con ícono globo en vez de checkbox para
              comunicar que es semánticamente distinto (todos vs uno
              específico). Mutex exclusive vía setSelected([]). */}
          <button
            key="no-preference"
            type="button"
            onClick={setNoLanguagePreference}
            aria-pressed={noLanguagePreference}
            className="rounded-[14px] px-3 py-2.5 text-[13px] font-bold transition-colors text-left"
            style={
              noLanguagePreference
                ? {
                    background: "rgba(252,211,77,0.12)",
                    border: "1px solid rgba(252,211,77,0.45)",
                    color: "var(--color-gold)",
                  }
                : {
                    background: "var(--card-bg)",
                    border: "1px solid var(--card-border)",
                    color: "var(--foreground)",
                  }
            }
          >
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className="inline-grid h-4 w-4 place-items-center text-[11px]"
              >
                🌐
              </span>
              No preference
            </span>
          </button>
          {LANGUAGES.map((lang) => {
            const active = selected.includes(lang.code);
            return (
              <button
                key={lang.code}
                onClick={() => toggleLanguage(lang.code)}
                className="rounded-[14px] px-3 py-2.5 text-[13px] font-bold transition-colors text-left"
                // Inactive language buttons antes usaban
                // `rgba(255,255,255,X)` inline → invisible en light.
                // Pasamos a tokens semánticos.
                style={
                  active
                    ? {
                        background: "rgba(252,211,77,0.12)",
                        border: "1px solid rgba(252,211,77,0.45)",
                        color: "var(--color-gold)",
                      }
                    : {
                        background: "var(--card-bg)",
                        border: "1px solid var(--card-border)",
                        color: "var(--foreground)",
                      }
                }
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-grid h-4 w-4 place-items-center rounded-full text-[10px]"
                    style={
                      active
                        ? { background: "var(--color-gold)", color: "var(--color-gold-ink)" }
                        : { border: "1.5px solid var(--card-border)" }
                    }
                  >
                    {active ? "✓" : ""}
                  </span>
                  {lang.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Personalize tiles (Level / Variant / Region) ── */}
      <div className="mb-3 rounded-[20px] border border-white/8 bg-white/[0.025] p-4">
        <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/55">Personalize</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <label
            className="rounded-[14px] border border-white/8 p-3 block"
            style={{ background: "var(--chip-bg)" }}
          >
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/45 mb-1.5">Level</span>
            <select
              value={preferredLevel}
              onChange={(e) => setPreferredLevel(e.target.value)}
              className="w-full bg-transparent text-[13px] font-bold text-white outline-none"
              style={{ appearance: "none" }}
            >
              <option value="" className="bg-[#0b1e36]">No preference</option>
              {LEVEL_OPTIONS.map((level) => (
                <option key={level} value={level} className="bg-[#0b1e36]">
                  {level}
                </option>
              ))}
            </select>
          </label>

          <label
            className="rounded-[14px] border border-white/8 p-3 block"
            style={{ background: "var(--chip-bg)" }}
          >
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/45 mb-1.5">Variant</span>
            <select
              value={preferredVariant}
              onChange={(e) => setPreferredVariant(e.target.value)}
              disabled={availableVariants.length === 0}
              className="w-full bg-transparent text-[13px] font-bold text-white outline-none disabled:opacity-50"
              style={{ appearance: "none" }}
            >
              <option value="" className="bg-[#0b1e36]">
                {availableVariants.length > 0 ? "No preference" : "Not available"}
              </option>
              {availableVariants.map((variant) => (
                <option key={variant.value} value={variant.value} className="bg-[#0b1e36]">
                  {formatVariantLabel(variant.value) ?? variant.label}
                </option>
              ))}
            </select>
          </label>

          <label
            className="rounded-[14px] border border-white/8 p-3 block"
            style={{ background: "var(--chip-bg)" }}
          >
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/45 mb-1.5">Region</span>
            <select
              value={preferredRegion}
              onChange={(e) => setPreferredRegion(e.target.value)}
              className="w-full bg-transparent text-[13px] font-bold text-white outline-none"
              style={{ appearance: "none" }}
            >
              <option value="" className="bg-[#0b1e36]">No preference</option>
              {REGION_OPTIONS.map((region) => (
                <option key={region} value={region} className="bg-[#0b1e36]">
                  {region}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* ── Daily reminder ── */}
      <div className="mb-3 rounded-[20px] border border-white/8 bg-white/[0.025] p-4">
        <div className="flex items-center gap-3">
          <div
            className="grid place-items-center shrink-0"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(125,211,252,0.1)",
            }}
          >
            <Bell size={16} className="text-[#7dd3fc]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-white text-[15px]">Daily reminder</p>
            <p className="text-[12px] text-white/55 truncate">
              {!remindersEnabled
                ? "Off"
                : typeof reminderHour === "number"
                  ? `Once a day at ${formatReminderHour(reminderHour)}${typeof reminderMinute === "number" ? `:${reminderMinute.toString().padStart(2, "0")}` : ""}`
                  : "On · pick a time"}
            </p>
          </div>
          {/* iPhone-style toggle. Uses inline-block + transform so the knob
              position is bulletproof against Tailwind v4 arbitrary-value
              drops. Off-state track is light gray (matches the iOS look)
              instead of the previous near-invisible 12% white. */}
          <button
            type="button"
            role="switch"
            aria-checked={remindersEnabled}
            aria-label={remindersEnabled ? "Turn reminders off" : "Turn reminders on"}
            onClick={() => setRemindersEnabled(!remindersEnabled)}
            className="shrink-0 relative inline-block"
            style={{
              width: 51,
              height: 31,
              borderRadius: 999,
              background: remindersEnabled ? "var(--color-gold)" : "rgba(120, 120, 128, 0.5)",
              transition: "background-color 180ms ease",
              cursor: "pointer",
              border: "none",
              padding: 0,
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 2,
                left: 2,
                width: 27,
                height: 27,
                borderRadius: "50%",
                background: "#ffffff",
                boxShadow:
                  "0 3px 8px rgba(0, 0, 0, 0.15), 0 3px 1px rgba(0, 0, 0, 0.06)",
                transform: remindersEnabled ? "translateX(20px)" : "translateX(0)",
                transition: "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
              }}
            />
          </button>
        </div>

        {remindersEnabled ? (
          // Time picker custom: dos <select> estilizados (Hour 12h + Minute)
          // + segmented AM/PM. Sin native browser time chrome (que se ve
          // horrible en desktop). El estado interno sigue siendo 24h para
          // mantener compat con REMINDER_HOUR_OPTIONS del server.
          (() => {
            const hh24 = typeof reminderHour === "number" ? reminderHour : 8;
            const mm = typeof reminderMinute === "number" ? reminderMinute : 0;
            const isPM = hh24 >= 12;
            const hh12 = hh24 % 12 === 0 ? 12 : hh24 % 12;
            const setFrom12h = (next12: number, nextIsPM: boolean) => {
              const base = next12 % 12; // 12→0, 1-11 stay
              const next24 = nextIsPM ? base + 12 : base;
              if (REMINDER_HOUR_OPTIONS.includes(next24 as (typeof REMINDER_HOUR_OPTIONS)[number])) {
                setReminderHour(next24 as (typeof REMINDER_HOUR_OPTIONS)[number]);
              }
            };
            // Anchos fijos para que valor + chevron no se solapen. El
            // valor se alinea a la izquierda y el chevron vive en el
            // padding-right reservado (24px). text-align:left fuerza que
            // el browser no centre los dígitos.
            const selectClass =
              "appearance-none rounded-xl bg-white/[0.04] border border-white/10 text-white font-extrabold text-[16px] focus:outline-none focus:border-white/30 cursor-pointer";
            const selectStyle: CSSProperties = {
              paddingLeft: 14,
              paddingRight: 30,
              paddingTop: 10,
              paddingBottom: 10,
              textAlign: "left",
              textAlignLast: "left",
              minWidth: 78,
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12' fill='none'><path d='M3 4.5l3 3 3-3' stroke='rgba(255,255,255,0.55)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
              backgroundSize: "10px 10px",
              colorScheme: "dark",
            };
            return (
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/45">
                  Time
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Hour"
                    value={hh12}
                    onChange={(e) => setFrom12h(Number(e.target.value), isPM)}
                    className={selectClass}
                    style={selectStyle}
                  >
                    {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-[18px] font-black text-white/45">:</span>
                  <select
                    aria-label="Minute"
                    value={mm}
                    onChange={(e) =>
                      setReminderMinute(
                        Number(e.target.value) as (typeof REMINDER_MINUTE_OPTIONS)[number]
                      )
                    }
                    className={selectClass}
                    style={selectStyle}
                  >
                    {REMINDER_MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m.toString().padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                  {/* Segmented AM/PM */}
                  <div className="ml-1 inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
                    {([
                      { label: "AM", value: false },
                      { label: "PM", value: true },
                    ] as const).map((opt) => {
                      const active = opt.value === isPM;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setFrom12h(hh12, opt.value)}
                          className="rounded-lg px-3 py-1.5 text-[12px] font-extrabold transition-colors"
                          style={
                            active
                              ? { background: "var(--color-gold)", color: "var(--color-gold-ink)" }
                              : { background: "transparent", color: "var(--muted)" }
                          }
                          aria-pressed={active}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()
        ) : null}
      </div>

      {/* ── Interests ── */}
      <div className="mb-3 rounded-[20px] border border-white/8 bg-white/[0.025] p-4">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/55">Interests</p>
          <span className="text-[12px] font-bold text-white/45">
            {interests.length}/{MAX_INTERESTS}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {SUGGESTED_INTERESTS.map((interest) => {
            const active = interests.some((item) => item.toLowerCase() === interest.toLowerCase());
            return (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className="rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors"
                style={
                  active
                    ? { background: "var(--color-gold)", color: "var(--color-gold-ink)" }
                    : { background: "var(--chip-bg)", color: "var(--foreground)", border: "1px solid var(--chip-border)" }
                }
              >
                {interest}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mb-3">
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
            className="flex-1 rounded-full border border-white/8 px-4 py-2 text-[13px] text-white outline-none focus:border-[var(--color-gold)]"
            style={{ background: "var(--chip-bg)" }}
          />
          <button
            type="button"
            onClick={addCustomInterest}
            className="rounded-full bg-[var(--color-gold)] px-4 py-2 text-[12px] font-extrabold text-[#2a1a02] hover:brightness-105"
          >
            Add
          </button>
        </div>
        {interests.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {interests.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className="rounded-full bg-[var(--color-gold)]/15 border border-[var(--color-gold)]/35 px-3 py-1.5 text-[12px] font-bold text-[var(--color-gold)] hover:bg-[var(--color-gold)]/22"
                title="Remove interest"
              >
                {interest} ×
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-white/45">No interests selected yet.</p>
        )}
      </div>
        </>
      ) : null}

      {/* ─────────────── PRIVACY TAB ─────────────── */}
      {activeTab === "privacy" ? (
        <>
      {/* ── Privacy ── */}
      <div className="mb-3 rounded-[20px] border border-white/8 bg-white/[0.025] p-4">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/55">Privacy &amp; cookies</p>
        <p className="text-[13px] text-white/72">
          Analytics cookies are currently{" "}
          <span className="font-extrabold text-white">
            {analyticsConsent === "accepted"
              ? "accepted"
              : analyticsConsent === "rejected"
              ? "rejected"
              : "not chosen yet"}
          </span>.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => updateAnalyticsConsent("accepted")}
            className="rounded-full bg-[var(--color-gold)] px-3.5 py-1.5 text-[12px] font-extrabold text-[#2a1a02] hover:brightness-105"
          >
            Allow analytics
          </button>
          <button
            type="button"
            onClick={() => updateAnalyticsConsent("rejected")}
            className="rounded-full bg-white/[0.04] border border-white/8 px-3.5 py-1.5 text-[12px] font-bold text-white/80 hover:bg-white/[0.08]"
          >
            Reject analytics
          </button>
          <Link
            href="/cookies"
            className="rounded-full bg-transparent border border-white/8 px-3.5 py-1.5 text-[12px] font-bold text-white/65 hover:bg-white/[0.05]"
          >
            Read Cookie Policy
          </Link>
        </div>
      </div>
        </>
      ) : null}

      {/* ── Save status (sticky bottom) ── */}
      <div className="sticky bottom-[4.75rem] mt-6">
        <div className="rounded-full border border-white/10 bg-[var(--bg-content)]/95 backdrop-blur px-4 py-2 text-[13px] text-white/80 text-center">
          {status === "saving" ? "Saving changes…" : null}
          {status === "saved" ? "Saved" : null}
          {status === "error" ? "Could not save" : null}
          {status === "idle" && dirty ? "Unsaved changes" : null}
          {status === "idle" && !dirty ? "Settings are up to date" : null}
          {hint ? (
            <span className="ml-2 font-extrabold text-[var(--color-gold)]">{hint}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
