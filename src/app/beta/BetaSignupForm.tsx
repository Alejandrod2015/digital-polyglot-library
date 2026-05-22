"use client";

import { useEffect, useRef, useState } from "react";
import { trackGa4Event } from "@/lib/ga4";

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

const WEEKLY_HOURS = [
  { value: "1-3", label: "1-3 hrs" },
  { value: "4-7", label: "4-7 hrs" },
  { value: "8+", label: "8+ hrs" },
];

const MOTIVATIONS = [
  "Travel",
  "Family connection",
  "Work",
  "Move abroad",
  "Just for fun",
  "Other",
];

const REFERRAL_SOURCES = [
  "Instagram",
  "TikTok",
  "Google search",
  "Friend",
  "Podcast",
  "Blog or article",
  "Other",
];

const APPLICATION_REASON_MIN = 20;
const APPLICATION_REASON_MAX = 1000;

const ATTRIBUTION_STORAGE_KEY = "dp_beta_attribution_v1";

type AttributionPayload = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingUrl?: string;
  timezone?: string;
};

function readPersistedAttribution(): AttributionPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as AttributionPayload) : null;
  } catch {
    return null;
  }
}

function captureAttribution(): AttributionPayload {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const get = (k: string) => params.get(k)?.trim() || undefined;
  let timezone: string | undefined;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    timezone = undefined;
  }
  const attribution: AttributionPayload = {
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    utmContent: get("utm_content"),
    utmTerm: get("utm_term"),
    referrer: document.referrer?.trim() || undefined,
    landingUrl: window.location.href,
    timezone,
  };
  // Drop empty keys
  return Object.fromEntries(
    Object.entries(attribution).filter(([, v]) => Boolean(v)),
  ) as AttributionPayload;
}

type FormState = {
  firstName: string;
  email: string;
  appleIdEmail: string;
  socialHandle: string;
  nativeLanguage: string;
  nativeLanguageOther: string;
  targetLanguage: string;
  targetLanguageOther: string;
  currentLevel: string;
  hasIPhone: "yes" | "no" | "";
  weeklyHours: string;
  motivation: string;
  motivationOther: string;
  referralSource: string;
  referralSourceOther: string;
  applicationReason: string;
  consent: boolean;
  // Honeypot: campo oculto vía CSS. Si llega lleno = bot.
  // Cero fricción para humanos (display:none) y atrapa el 80-90%
  // de bots tontos que rellenan todo lo que ven.
  website: string;
};

const initialState: FormState = {
  firstName: "",
  email: "",
  appleIdEmail: "",
  socialHandle: "",
  nativeLanguage: "",
  nativeLanguageOther: "",
  targetLanguage: "",
  targetLanguageOther: "",
  currentLevel: "",
  hasIPhone: "",
  weeklyHours: "",
  motivation: "",
  motivationOther: "",
  referralSource: "",
  referralSourceOther: "",
  applicationReason: "",
  consent: false,
  website: "",
};

// Antibot: tiempo mínimo entre montaje del form y submit. Humanos
// llenan en >5s típicamente; bots scriptados envían en <500ms. Si
// el delta es <2.5s asumimos bot y rechazamos en el server.
const MIN_SUBMIT_DELAY_MS = 2500;

const labelStyle = "mb-1.5 block text-sm font-extrabold text-white";
const inputStyle =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-white placeholder:text-white/40 transition focus:border-[#fcd34d] focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#fcd34d33]";
const selectStyle = `${inputStyle} appearance-none bg-[image:linear-gradient(45deg,transparent_50%,rgba(255,255,255,0.45)_50%),linear-gradient(135deg,rgba(255,255,255,0.45)_50%,transparent_50%)] bg-[position:calc(100%-18px)_calc(50%-3px),calc(100%-13px)_calc(50%-3px)] bg-[size:5px_5px,5px_5px] bg-no-repeat pr-10`;
const helperStyle = "mt-1.5 text-xs font-bold text-white/45";

function chipClass(active: boolean) {
  return `flex cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-extrabold transition ${
    active
      ? "border-[#fcd34d4d] bg-[#fcd34d1a] text-[#fcd34d] shadow-[inset_0_0_0_1px_#fcd34d80]"
      : "border-white/10 bg-transparent text-white/65 hover:border-white/20 hover:text-white"
  }`;
}

export default function BetaSignupForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<null | { duplicate?: boolean }>(null);
  const [error, setError] = useState<string | null>(null);
  // Captured once on mount so UTM + referrer survive any internal nav the
  // visitor does between landing and submit.
  const attributionRef = useRef<AttributionPayload>({});
  // Mount timestamp para el check de time-to-submit. Si el form se
  // envía antes de MIN_SUBMIT_DELAY_MS, asumimos bot. El server
  // valida lo mismo recibiendo `clientMountedAt`.
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    const persisted = readPersistedAttribution();
    if (persisted && Object.keys(persisted).length > 0) {
      attributionRef.current = persisted;
      return;
    }
    const fresh = captureAttribution();
    attributionRef.current = fresh;
    if (Object.keys(fresh).length > 0) {
      try {
        window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(fresh));
      } catch {
        // sessionStorage blocked: keep the in-memory copy and move on.
      }
    }
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resolvedNativeLanguage(): string {
    return form.nativeLanguage === "Other" ? form.nativeLanguageOther.trim() : form.nativeLanguage;
  }

  function resolvedTargetLanguage(): string {
    return form.targetLanguage === "Other" ? form.targetLanguageOther.trim() : form.targetLanguage;
  }

  function resolvedMotivation(): string {
    return form.motivation === "Other" ? form.motivationOther.trim() : form.motivation;
  }

  function resolvedReferralSource(): string {
    return form.referralSource === "Other"
      ? form.referralSourceOther.trim()
      : form.referralSource;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Antibot client-side. El server revalida los mismos checks, pero
    // detenerlos acá ahorra round-trips a Resend para bots tontos.
    if (form.website.trim().length > 0) {
      // Honeypot filled = bot. Falso "submitted" para no señalizar el
      // motivo del rechazo.
      setSubmitted({});
      return;
    }
    const elapsedMs = Date.now() - mountedAtRef.current;
    if (elapsedMs < MIN_SUBMIT_DELAY_MS) {
      // Demasiado rápido = bot. Mismo trato silencioso.
      setSubmitted({});
      return;
    }

    if (!form.firstName.trim()) {
      setError("Please tell us your first name.");
      return;
    }
    if (!form.appleIdEmail.trim()) {
      setError("Please share the email tied to your Apple ID (we send the TestFlight invite there).");
      return;
    }
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
    if (!form.weeklyHours) {
      setError("Please pick how many hours per week you'll dedicate.");
      return;
    }
    const motivation = resolvedMotivation();
    if (!motivation) {
      setError("Please tell us why you're learning.");
      return;
    }
    const referralSource = resolvedReferralSource();
    if (!referralSource) {
      setError("Please tell us how you heard about us.");
      return;
    }
    const applicationReason = form.applicationReason.trim();
    if (applicationReason.length < APPLICATION_REASON_MIN) {
      setError(
        `Please write at least ${APPLICATION_REASON_MIN} characters about why you're applying.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/beta-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          email: form.email,
          appleIdEmail: form.appleIdEmail.trim(),
          socialHandle: form.socialHandle.trim() || undefined,
          nativeLanguage,
          targetLanguage,
          currentLevel: LEVELS.find((l) => l.value === form.currentLevel)?.label ?? form.currentLevel,
          hasIPhone: form.hasIPhone === "yes",
          weeklyHours: form.weeklyHours,
          motivation,
          referralSource,
          applicationReason,
          consent: form.consent,
          attribution: attributionRef.current,
          // Antibot signals para el server (revalida estos checks).
          website: form.website,
          clientElapsedMs: elapsedMs,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : `Submission failed (HTTP ${res.status}).`);
        return;
      }
      setSubmitted({ duplicate: data.duplicate === true });
      trackGa4Event("beta_apply", {
        duplicate: data.duplicate === true,
        target_language: targetLanguage,
        native_language: nativeLanguage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-3xl border border-[#fcd34d4d] bg-gradient-to-b from-[#fcd34d1a] to-white/[0.03] p-10 text-center">
        <div className="mb-3 text-4xl" aria-hidden>
          🎉
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight text-white">
          {submitted.duplicate ? "You're already on the list" : "Application received"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm font-bold text-white/65">
          {submitted.duplicate
            ? "We already have your application on file. We'll be in touch as spots open."
            : "Thanks for applying. We sent a confirmation to your email and will follow up with an invite when a spot opens."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)] sm:p-8"
      noValidate
    >
      {/* Honeypot: campo trampa. Oculto vía CSS + atributos que
          desincentivan autocompletado del browser y screen-readers.
          Los bots ven el campo en el DOM y lo rellenan; humanos no
          lo ven. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: 1,
          height: 1,
          overflow: "hidden",
          opacity: 0,
          pointerEvents: "none",
        }}
      >
        <label htmlFor="website-url">Your website (leave empty)</label>
        <input
          id="website-url"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => update("website", e.target.value)}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className={labelStyle}>
            First name
          </label>
          <input
            id="firstName"
            type="text"
            required
            autoComplete="given-name"
            value={form.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            className={inputStyle}
            placeholder="Alex"
            maxLength={80}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelStyle}>
            Contact email
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
      </div>

      <div>
        <label htmlFor="appleIdEmail" className={labelStyle}>
          Apple ID email
        </label>
        <input
          id="appleIdEmail"
          type="email"
          required
          autoComplete="email"
          value={form.appleIdEmail}
          onChange={(e) => update("appleIdEmail", e.target.value)}
          className={inputStyle}
          placeholder="apple-id@icloud.com"
        />
        <p className={helperStyle}>
          We send the TestFlight invite to your Apple ID. It can be the same as your contact email.
        </p>
      </div>

      <div>
        <label htmlFor="socialHandle" className={labelStyle}>
          LinkedIn or X handle <span className="font-bold text-white/40">(optional)</span>
        </label>
        <input
          id="socialHandle"
          type="text"
          autoComplete="off"
          value={form.socialHandle}
          onChange={(e) => update("socialHandle", e.target.value)}
          className={inputStyle}
          placeholder="linkedin.com/in/you or @yourhandle"
          maxLength={200}
        />
        <p className={helperStyle}>
          Helps us review faster. We don&apos;t share or contact you there.
        </p>
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
        <span className={labelStyle}>Do you have an iPhone with iOS 17 or newer?</span>
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
        <p className={helperStyle}>The beta is iPhone-only for now.</p>
      </div>

      <div>
        <span className={labelStyle}>Hours per week you'll dedicate</span>
        <div className="grid grid-cols-3 gap-2">
          {WEEKLY_HOURS.map((opt) => (
            <label key={opt.value} className={chipClass(form.weeklyHours === opt.value)}>
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
        <label htmlFor="motivation" className={labelStyle}>
          Why are you learning?
        </label>
        <select
          id="motivation"
          required
          value={form.motivation}
          onChange={(e) => update("motivation", e.target.value)}
          className={selectStyle}
        >
          <option value="" disabled>
            Pick one
          </option>
          {MOTIVATIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {form.motivation === "Other" && (
          <input
            type="text"
            required
            value={form.motivationOther}
            onChange={(e) => update("motivationOther", e.target.value)}
            className={`${inputStyle} mt-2`}
            placeholder="Your reason"
            maxLength={200}
          />
        )}
      </div>

      <div>
        <label htmlFor="referralSource" className={labelStyle}>
          How did you hear about us?
        </label>
        <select
          id="referralSource"
          required
          value={form.referralSource}
          onChange={(e) => update("referralSource", e.target.value)}
          className={selectStyle}
        >
          <option value="" disabled>
            Pick one
          </option>
          {REFERRAL_SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {form.referralSource === "Other" && (
          <input
            type="text"
            required
            value={form.referralSourceOther}
            onChange={(e) => update("referralSourceOther", e.target.value)}
            className={`${inputStyle} mt-2`}
            placeholder="Where did you hear about us?"
            maxLength={200}
          />
        )}
      </div>

      <div>
        <label htmlFor="applicationReason" className={labelStyle}>
          Why are you applying to the beta?
        </label>
        <textarea
          id="applicationReason"
          required
          value={form.applicationReason}
          onChange={(e) => update("applicationReason", e.target.value)}
          className={`${inputStyle} min-h-[96px] resize-y`}
          placeholder="A few sentences. What do you want to get out of it?"
          minLength={APPLICATION_REASON_MIN}
          maxLength={APPLICATION_REASON_MAX}
        />
        <p className={helperStyle}>
          {form.applicationReason.trim().length}/{APPLICATION_REASON_MAX} · min{" "}
          {APPLICATION_REASON_MIN}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs font-bold leading-relaxed text-white/65">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(e) => update("consent", e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#fcd34d]"
        />
        <span>
          I agree to my data being processed for the Digital Polyglot beta program as described in the{" "}
          <a className="underline text-white" href="/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
          . I can request deletion any time.
        </span>
      </label>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-[#fcd34d] px-6 py-3.5 text-sm font-black tracking-tight text-[#051834] shadow-[0_10px_30px_-10px_rgba(252,211,77,0.6)] transition hover:bg-[#fde889] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Apply for the beta →"}
      </button>
    </form>
  );
}
