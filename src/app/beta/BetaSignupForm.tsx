"use client";

import { useState } from "react";

type WeeklyHours = "15min" | "1h" | "several_hours";

type FormState = {
  email: string;
  nativeLanguage: string;
  targetLanguage: string;
  currentLevel: string;
  hasIPhone: "yes" | "no" | "";
  currentApps: string;
  weeklyHours: WeeklyHours | "";
  referralSource: string;
  consent: boolean;
};

const initialState: FormState = {
  email: "",
  nativeLanguage: "",
  targetLanguage: "",
  currentLevel: "",
  hasIPhone: "",
  currentApps: "",
  weeklyHours: "",
  referralSource: "",
  consent: false,
};

const labelStyle = "mb-1.5 block text-sm font-semibold text-[var(--foreground)]";
const inputStyle =
  "w-full rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--studio-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--studio-accent-soft)]";
const helperStyle = "mt-1 text-xs text-[var(--muted)]";

export default function BetaSignupForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<null | { duplicate?: boolean }>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.consent) {
      setError("Please accept the privacy notice to continue.");
      return;
    }
    if (!form.hasIPhone) {
      setError("Please let us know whether you have an iPhone.");
      return;
    }
    if (!form.weeklyHours) {
      setError("Please pick a weekly time commitment.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          nativeLanguage: form.nativeLanguage,
          targetLanguage: form.targetLanguage,
          currentLevel: form.currentLevel,
          hasIPhone: form.hasIPhone === "yes",
          currentApps: form.currentApps || null,
          weeklyHours: form.weeklyHours,
          referralSource: form.referralSource || null,
          consent: form.consent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : `Submission failed (HTTP ${res.status}).`);
        return;
      }
      setSubmitted({ duplicate: data.duplicate === true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 text-center">
        <h2 className="text-2xl font-bold">
          {submitted.duplicate ? "You're already on the list" : "Application received 🎉"}
        </h2>
        <p className="mt-3 text-[var(--muted)]">
          {submitted.duplicate
            ? "We already have your application on file. We'll be in touch as spots open."
            : "Thanks for applying. We sent a confirmation to your email and will follow up with a TestFlight invite when a spot opens."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 sm:p-8"
      noValidate
    >
      <div>
        <label htmlFor="email" className={labelStyle}>
          Email <span className="text-red-400">*</span>
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className={inputStyle}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="nativeLanguage" className={labelStyle}>
          Native language <span className="text-red-400">*</span>
        </label>
        <input
          id="nativeLanguage"
          type="text"
          required
          value={form.nativeLanguage}
          onChange={(e) => update("nativeLanguage", e.target.value)}
          className={inputStyle}
          placeholder="e.g. English, Spanish (heritage), Mandarin"
        />
        <p className={helperStyle}>If you grew up around more than one language, list all of them.</p>
      </div>

      <div>
        <label htmlFor="targetLanguage" className={labelStyle}>
          Language you want to learn or reconnect with <span className="text-red-400">*</span>
        </label>
        <input
          id="targetLanguage"
          type="text"
          required
          value={form.targetLanguage}
          onChange={(e) => update("targetLanguage", e.target.value)}
          className={inputStyle}
          placeholder="e.g. German, Italian, Portuguese"
        />
      </div>

      <div>
        <label htmlFor="currentLevel" className={labelStyle}>
          How would you describe your current level? <span className="text-red-400">*</span>
        </label>
        <input
          id="currentLevel"
          type="text"
          required
          value={form.currentLevel}
          onChange={(e) => update("currentLevel", e.target.value)}
          className={inputStyle}
          placeholder="e.g. I understand but don't speak, A2, spoke as a child"
        />
        <p className={helperStyle}>Free-form. CEFR levels, life context, anything that helps us understand you.</p>
      </div>

      <div>
        <span className={labelStyle}>
          Do you have an iPhone running iOS 17 or newer? <span className="text-red-400">*</span>
        </span>
        <div className="flex gap-3">
          {(["yes", "no"] as const).map((value) => (
            <label
              key={value}
              className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                form.hasIPhone === value
                  ? "border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] text-[var(--foreground)]"
                  : "border-[var(--card-border)] bg-transparent text-[var(--muted)] hover:border-[var(--chip-border)]"
              }`}
            >
              <input
                type="radio"
                name="hasIPhone"
                value={value}
                checked={form.hasIPhone === value}
                onChange={() => update("hasIPhone", value)}
                className="sr-only"
              />
              {value === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
        <p className={helperStyle}>The beta runs on TestFlight, which is iOS-only for now.</p>
      </div>

      <div>
        <label htmlFor="currentApps" className={labelStyle}>
          What language apps do you use today, and what frustrates you about them?
        </label>
        <textarea
          id="currentApps"
          rows={3}
          value={form.currentApps}
          onChange={(e) => update("currentApps", e.target.value)}
          className={inputStyle}
          placeholder="Optional. Helps us understand your context."
        />
      </div>

      <div>
        <span className={labelStyle}>
          Weekly time you can give to the beta <span className="text-red-400">*</span>
        </span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {([
            { value: "15min", label: "~15 min / week" },
            { value: "1h", label: "~1 hour / week" },
            { value: "several_hours", label: "Several hours / week" },
          ] as const).map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                form.weeklyHours === opt.value
                  ? "border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] text-[var(--foreground)]"
                  : "border-[var(--card-border)] bg-transparent text-[var(--muted)] hover:border-[var(--chip-border)]"
              }`}
            >
              <input
                type="radio"
                name="weeklyHours"
                value={opt.value}
                checked={form.weeklyHours === opt.value}
                onChange={() => update("weeklyHours", opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="referralSource" className={labelStyle}>
          How did you hear about us?
        </label>
        <input
          id="referralSource"
          type="text"
          value={form.referralSource}
          onChange={(e) => update("referralSource", e.target.value)}
          className={inputStyle}
          placeholder="Optional. E.g. bought a book, Instagram, a friend"
        />
      </div>

      <div className="rounded-lg border border-[var(--card-border)] bg-[var(--background)] p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => update("consent", e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--studio-accent)]"
          />
          <span>
            I agree to my data being processed for the Digital Polyglot beta program as described in the{" "}
            <a className="underline text-[var(--foreground)]" href="/privacy" target="_blank" rel="noreferrer">
              Privacy Policy
            </a>
            . I can request deletion any time via{" "}
            <a className="underline text-[var(--foreground)]" href="/data-deletion" target="_blank" rel="noreferrer">
              data deletion
            </a>
            .
          </span>
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-[var(--studio-accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--studio-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Apply for the beta"}
      </button>
    </form>
  );
}
