"use client";

import { useState } from "react";

const NATIVE_LANGUAGES = [
  "English",
  "Spanish",
  "Portuguese",
  "German",
  "Italian",
  "French",
  "Mandarin",
  "Arabic",
  "Russian",
  "Hindi",
  "Korean",
  "Japanese",
  "Turkish",
];

const TARGET_LANGUAGES = ["Spanish", "German", "Italian", "Portuguese", "French"];

const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

type FormState = {
  email: string;
  nativeLanguage: string;
  nativeLanguageOther: string;
  targetLanguage: string;
  targetLanguageOther: string;
  currentLevel: string;
  hasIPhone: "yes" | "no" | "";
  consent: boolean;
};

const initialState: FormState = {
  email: "",
  nativeLanguage: "",
  nativeLanguageOther: "",
  targetLanguage: "",
  targetLanguageOther: "",
  currentLevel: "",
  hasIPhone: "",
  consent: false,
};

const labelStyle = "mb-1.5 block text-sm font-semibold text-[var(--foreground)]";
const inputStyle =
  "w-full rounded-xl border border-[var(--card-border)] bg-[var(--background)]/60 px-4 py-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition focus:border-[var(--studio-accent)] focus:bg-[var(--background)] focus:outline-none focus:ring-2 focus:ring-[var(--studio-accent-soft)]";
const selectStyle = `${inputStyle} appearance-none bg-[image:linear-gradient(45deg,transparent_50%,var(--muted)_50%),linear-gradient(135deg,var(--muted)_50%,transparent_50%)] bg-[position:calc(100%-18px)_calc(50%-3px),calc(100%-13px)_calc(50%-3px)] bg-[size:5px_5px,5px_5px] bg-no-repeat pr-10`;
const helperStyle = "mt-1.5 text-xs text-[var(--muted)]";

function chipClass(active: boolean) {
  return `flex cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-semibold transition ${
    active
      ? "border-[var(--studio-accent)] bg-[var(--studio-accent-soft)] text-[var(--foreground)] shadow-[inset_0_0_0_1px_var(--studio-accent)]"
      : "border-[var(--card-border)] bg-transparent text-[var(--muted)] hover:border-[var(--chip-border)] hover:text-[var(--foreground)]"
  }`;
}

export default function BetaSignupForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<null | { duplicate?: boolean }>(null);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resolvedNativeLanguage(): string {
    return form.nativeLanguage === "Other" ? form.nativeLanguageOther.trim() : form.nativeLanguage;
  }

  function resolvedTargetLanguage(): string {
    return form.targetLanguage === "Other" ? form.targetLanguageOther.trim() : form.targetLanguage;
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
    const nativeLanguage = resolvedNativeLanguage();
    const targetLanguage = resolvedTargetLanguage();
    if (!nativeLanguage) {
      setError("Please pick or type your native language.");
      return;
    }
    if (!targetLanguage) {
      setError("Please pick or type the language you want to learn.");
      return;
    }
    if (!form.currentLevel) {
      setError("Please pick your current level.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          nativeLanguage,
          targetLanguage,
          currentLevel: LEVELS.find((l) => l.value === form.currentLevel)?.label ?? form.currentLevel,
          hasIPhone: form.hasIPhone === "yes",
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
      <div className="rounded-3xl border border-[var(--studio-accent)]/30 bg-gradient-to-b from-[var(--studio-accent-soft)] to-[var(--card-bg)] p-10 text-center">
        <div className="mb-3 text-4xl" aria-hidden>
          🎉
        </div>
        <h2 className="text-2xl font-bold">
          {submitted.duplicate ? "You're already on the list" : "Application received"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-[var(--muted)]">
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
      className="space-y-5 rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] sm:p-8"
      noValidate
    >
      <div>
        <label htmlFor="email" className={labelStyle}>
          Email
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="nativeLanguage" className={labelStyle}>
            Native language
          </label>
          <select
            id="nativeLanguage"
            required
            value={form.nativeLanguage}
            onChange={(e) => update("nativeLanguage", e.target.value)}
            className={selectStyle}
          >
            <option value="" disabled>
              Pick one
            </option>
            {NATIVE_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
            <option value="Other">Other...</option>
          </select>
          {form.nativeLanguage === "Other" && (
            <input
              type="text"
              required
              value={form.nativeLanguageOther}
              onChange={(e) => update("nativeLanguageOther", e.target.value)}
              className={`${inputStyle} mt-2`}
              placeholder="Your native language"
              maxLength={100}
            />
          )}
        </div>

        <div>
          <label htmlFor="targetLanguage" className={labelStyle}>
            Language you want to learn
          </label>
          <select
            id="targetLanguage"
            required
            value={form.targetLanguage}
            onChange={(e) => update("targetLanguage", e.target.value)}
            className={selectStyle}
          >
            <option value="" disabled>
              Pick one
            </option>
            {TARGET_LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
            <option value="Other">Other...</option>
          </select>
          {form.targetLanguage === "Other" && (
            <input
              type="text"
              required
              value={form.targetLanguageOther}
              onChange={(e) => update("targetLanguageOther", e.target.value)}
              className={`${inputStyle} mt-2`}
              placeholder="Which language?"
              maxLength={100}
            />
          )}
        </div>
      </div>

      <div>
        <span className={labelStyle}>Your current level</span>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((opt) => (
            <label key={opt.value} className={chipClass(form.currentLevel === opt.value)}>
              <input
                type="radio"
                name="currentLevel"
                value={opt.value}
                checked={form.currentLevel === opt.value}
                onChange={() => update("currentLevel", opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <span className={labelStyle}>Do you have an iPhone running iOS 17 or newer?</span>
        <div className="grid grid-cols-2 gap-3">
          {(["yes", "no"] as const).map((value) => (
            <label key={value} className={chipClass(form.hasIPhone === value)}>
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

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--background)]/40 p-4 text-xs leading-relaxed text-[var(--muted)]">
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
          . I can request deletion any time.
        </span>
      </label>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-[var(--studio-accent)] px-6 py-3.5 text-sm font-bold tracking-wide text-white shadow-[0_10px_30px_-10px_var(--studio-accent-glow)] transition hover:bg-[var(--studio-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Apply for the beta →"}
      </button>
    </form>
  );
}
