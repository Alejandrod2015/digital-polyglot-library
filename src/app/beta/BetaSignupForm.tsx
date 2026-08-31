"use client";

import { useEffect, useRef, useState } from "react";
import { trackGa4Event } from "@/lib/ga4";
import { trackMetaLead } from "@/lib/metaPixel";
// La lista vive en un módulo compartido: el portón de temas necesita saber
// cuáles de estas respuestas son un clic y no una frase escrita.
import { BETA_MOTIVATIONS } from "@/lib/betaMotivations";
import {
  BETA_TOPIC_INTERESTS,
  MAX_TOPIC_INTERESTS,
  topicInterestLabel,
} from "@/lib/betaTopicInterests";
import { TARGET_VARIANTS } from "@/lib/targetVariants";

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

const APPLICATION_REASON_MIN = 20;
// El formulario lleva `noValidate`, así que el `type="email"` del navegador no
// comprueba nada: sin esto, un correo mal escrito solo se detecta en el
// servidor y vuelve como un 400, a media pantalla de distancia del campo.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APPLICATION_REASON_MAX = 1000;

// v2: guarda también CUÁNDO se capturó, y vive en localStorage en vez de
// sessionStorage. Con sessionStorage, quien pulsaba el enlace de un correo y
// aplicaba dos días después entraba como "directo", que es precisamente el
// caso de la tienda: se descubre la beta comprando y se solicita más tarde.
const ATTRIBUTION_STORAGE_KEY = "dp_beta_attribution_v2";
/** Ventana de atribución. Más allá, el clic ya no explica la solicitud. */
const ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

type StoredAttribution = AttributionPayload & { storedAt?: number };

/** localStorage cuando se puede, sessionStorage cuando el navegador lo bloquea. */
function attributionStores(): Storage[] {
  if (typeof window === "undefined") return [];
  const stores: Storage[] = [];
  try {
    stores.push(window.localStorage);
  } catch {
    // localStorage bloqueado (Safari en privado, o cookies de terceros off).
  }
  try {
    stores.push(window.sessionStorage);
  } catch {
    // Sin almacenamiento: queda la copia en memoria de esta pestaña.
  }
  return stores;
}

function readPersistedAttribution(): StoredAttribution | null {
  for (const store of attributionStores()) {
    try {
      const raw = store.getItem(ATTRIBUTION_STORAGE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") continue;
      const stored = parsed as StoredAttribution;
      // Un toque caducado no se usa: mejor "directo" honesto que atribuir una
      // solicitud de hoy a una campaña de hace medio año.
      if (stored.storedAt && Date.now() - stored.storedAt > ATTRIBUTION_TTL_MS) continue;
      return stored;
    } catch {
      // Entrada corrupta: se ignora y se vuelve a capturar.
    }
  }
  return null;
}

function persistAttribution(payload: AttributionPayload): void {
  const body = JSON.stringify({ ...payload, storedAt: Date.now() });
  for (const store of attributionStores()) {
    try {
      store.setItem(ATTRIBUTION_STORAGE_KEY, body);
    } catch {
      // Almacenamiento lleno o bloqueado: seguimos con la copia en memoria.
    }
  }
}

/** Lo que se manda al servidor, sin el sello interno de cuándo se guardó. */
function withoutStoredAt(stored: StoredAttribution): AttributionPayload {
  const rest: StoredAttribution = { ...stored };
  delete rest.storedAt;
  return rest;
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
  // Which store the tester gets in through. Decides which account address the
  // form asks for, so it has to be answered before that field is rendered.
  platform: "ios" | "android" | "";
  appleIdEmail: string;
  googleEmail: string;
  nativeLanguage: string;
  nativeLanguageOther: string;
  targetLanguage: string;
  targetLanguageOther: string;
  targetVariant: string;
  targetVariantOther: string;
  currentLevel: string;
  weeklyHours: string;
  motivation: string;
  motivationOther: string;
  topicInterests: string[];
  topicInterestsOther: string;
  topicInterestsOtherOpen: boolean;
  applicationReason: string;
  consent: boolean;
  marketingConsent: boolean;
  // Honeypot: campo oculto vía CSS. Si llega lleno = bot.
  // Cero fricción para humanos (display:none) y atrapa el 80-90%
  // de bots tontos que rellenan todo lo que ven.
  website: string;
};

const initialState: FormState = {
  firstName: "",
  email: "",
  platform: "",
  appleIdEmail: "",
  googleEmail: "",
  nativeLanguage: "",
  nativeLanguageOther: "",
  targetLanguage: "",
  targetLanguageOther: "",
  targetVariant: "",
  targetVariantOther: "",
  currentLevel: "",
  weeklyHours: "",
  motivation: "",
  motivationOther: "",
  topicInterests: [],
  topicInterestsOther: "",
  topicInterestsOtherOpen: false,
  applicationReason: "",
  consent: false,
  marketingConsent: false,
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
  // Las variantes del idioma elegido, o undefined si ese idioma no tiene más
  // de un sabor de contenido (o lo escribieron a mano). Una sola fuente para
  // la validación y para el render: cuando estaban separadas, el submit
  // comprobaba una lista y la pantalla mostraba otra.
  const variantOptions = TARGET_VARIANTS[form.targetLanguage];
  // Captured once on mount so UTM + referrer survive any internal nav the
  // visitor does between landing and submit.
  const attributionRef = useRef<AttributionPayload>({});
  // Mount timestamp para el check de time-to-submit. Si el form se
  // envía antes de MIN_SUBMIT_DELAY_MS, asumimos bot. El server
  // valida lo mismo recibiendo `clientMountedAt`.
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    const fresh = captureAttribution();
    const persisted = readPersistedAttribution();
    // Se conserva el primer toque, con una excepción: una visita que TRAE
    // campaña gana siempre a un toque guardado que no la traía. Sin esto,
    // entrar directo una vez a /beta y volver luego desde el correo de la
    // tienda dejaba la campaña sin registrar y la tienda parecía no traer a
    // nadie.
    const keepPersisted =
      persisted && Object.keys(persisted).length > 0 && (Boolean(persisted.utmSource) || !fresh.utmSource);
    if (keepPersisted && persisted) {
      attributionRef.current = withoutStoredAt(persisted);
      return;
    }
    attributionRef.current = fresh;
    if (Object.keys(fresh).length > 0) persistAttribution(fresh);
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

  // "Other" guarda LO ESCRITO, nunca la palabra "Other": el portón de temas
  // distingue un clic del desplegable de una frase de alguien, y la palabra
  // "Other" no dice nada de nadie.
  function resolvedMotivation(): string {
    return form.motivation === "Other" ? form.motivationOther.trim() : form.motivation;
  }

  function toggleTopic(slug: string) {
    setForm((prev) => {
      const has = prev.topicInterests.includes(slug);
      if (has) {
        return { ...prev, topicInterests: prev.topicInterests.filter((t) => t !== slug) };
      }
      if (prev.topicInterests.length >= MAX_TOPIC_INTERESTS) return prev;
      return { ...prev, topicInterests: [...prev.topicInterests, slug] };
    });
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
    if (!EMAIL_RE.test(form.email.trim())) {
      setError("Please check your contact email.");
      return;
    }
    if (!form.platform) {
      setError("Please tell us which phone you'll be testing on.");
      return;
    }
    const wantsIos = form.platform === "ios";
    const wantsAndroid = form.platform === "android";
    if (wantsIos && !EMAIL_RE.test(form.appleIdEmail.trim())) {
      setError("Please add the email your iPhone's App Store uses. Your invitation to install is sent there.");
      return;
    }
    // Not the same failure as a missing Apple ID, even though it reads alike.
    // On Android access comes from a Google Group, so without this address
    // there is no account to let in and the tester link would never work.
    if (wantsAndroid && !EMAIL_RE.test(form.googleEmail.trim())) {
      setError("Please add the Google account your phone's Play Store uses. That is the one we let into the testers group.");
      return;
    }
    if (!form.consent) {
      setError("Please accept the privacy notice to continue.");
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
    // The `required` on the variant select is decorative: the form carries
    // `noValidate`, so nothing in the browser enforces it and two Spanish
    // applicants submitted a blank variant after the field shipped. Every
    // other answer is checked here by hand; this one was simply missed.
    // Sin "Not sure yet" desde el 2026-08-23: hay que elegir un sitio.
    if (variantOptions && !form.targetVariant) {
      setError("Please tell us which country's version you want to learn.");
      return;
    }
    if (variantOptions && form.targetVariant === "other" && !form.targetVariantOther.trim()) {
      setError("Please type which variant you have in mind.");
      return;
    }
    // Un idioma escrito a mano no tiene lista, y sigue haciendo falta saber
    // qué variante quiere: nada en este formulario se queda a medias.
    if (!variantOptions && !form.targetVariantOther.trim()) {
      setError("Please type which variant you want to learn.");
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
    if (!form.motivation) {
      setError("Please tell us why you're learning.");
      return;
    }
    const motivation = resolvedMotivation();
    if (!motivation) {
      setError("Please type why you're learning.");
      return;
    }
    const topicInterests = [
      ...form.topicInterests,
      ...(form.topicInterestsOther.trim() ? [form.topicInterestsOther.trim()] : []),
    ];
    if (topicInterests.length === 0) {
      setError("Please pick at least one topic you'd like to read about.");
      return;
    }
    // Abrir "Something else..." y dejarlo en blanco es la única forma que
    // quedaba de contestar a medias la pregunta de temas.
    if (form.topicInterestsOtherOpen && !form.topicInterestsOther.trim()) {
      setError("Please type which topic you have in mind.");
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
          platform: form.platform,
          appleIdEmail: wantsIos ? form.appleIdEmail.trim() : undefined,
          googleEmail: wantsAndroid ? form.googleEmail.trim() : undefined,
          nativeLanguage,
          targetLanguage,
          // Un idioma de la lista responde por desplegable, y "Somewhere
          // else..." abre el texto libre. Un idioma escrito a mano no tiene
          // desplegable que abrir, así que su país llega siempre por el texto.
          targetVariant:
            (variantOptions
              ? form.targetVariant === "other"
                ? form.targetVariantOther.trim()
                : form.targetVariant
              : form.targetVariantOther.trim()) || undefined,
          currentLevel: LEVELS.find((l) => l.value === form.currentLevel)?.label ?? form.currentLevel,
          // Kept for the rows and rules written before `platform` existed.
          // Derived now instead of asked: a separate iPhone question next to a
          // platform question is two ways to answer the same thing.
          hasIPhone: wantsIos,
          weeklyHours: form.weeklyHours,
          motivation,
          topicInterests,
          applicationReason,
          consent: form.consent,
          marketingConsent: form.marketingConsent,
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
      // Meta optimiza sobre este evento, así que una re-solicitud de alguien
      // que ya está en la lista NO cuenta: repetiría a la misma persona como
      // conversión nueva y enseñaría al algoritmo a buscar más de lo mismo.
      // GA4 sí las guarda las dos, con la bandera `duplicate`.
      if (data.duplicate !== true) {
        trackMetaLead({
          content_name: "beta_apply",
          target_language: targetLanguage,
          native_language: nativeLanguage,
        });
      }
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

      {/* Asked here, above the account field, because it decides which account
          field there is. Before this existed the form only ever asked for an
          Apple ID, so every Android applicant looked like an iPhone one. */}
      <div>
        <span className={labelStyle}>Which phone will you test on?</span>
        {/* No "Both" chip. It looked harmless and was not: whoever picked it
            ended up on the iOS path anyway (invitePlatform sends `both` to
            TestFlight), so it delivered nothing a plain iPhone pick did not,
            while demanding a second account field AND switching off both hard
            gates, which only fire when the platform is a single one. The value
            stays legal in the schema and in the code for older rows. */}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: "ios", label: "iPhone" },
              { value: "android", label: "Android" },
            ] as const
          ).map((opt) => (
            <label key={opt.value} className={chipClass(form.platform === opt.value)}>
              <input
                type="radio"
                name="platform"
                value={opt.value}
                checked={form.platform === opt.value}
                onChange={() => update("platform", opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
        {/* Aqui ponia "iPhone needs iOS 17 or newer. Android needs 8.0 or newer",
            y ese numero no salia de ninguna parte: la app es Expo SDK 54 con
            React Native 0.81 y no declara deploymentTarget propio ni en
            app.config.js ni en eas.json, asi que hereda un minimo bastante mas
            bajo que iOS 17. Pedir 17 dejaba fuera a quien tiene un iPhone en
            iOS 16 que instalaria la app sin problema. No se sustituye por otro
            numero porque no hay forma de verificarlo desde aqui (la app aun no
            tiene ficha publica en App Store ni en Play); quien de verdad
            decide es la tienda, que le dira al tester si su telefono no puede
            instalarla. Si algun dia se fija un minimo real, ponerlo aqui. */}
        <p className={helperStyle}>
          TestFlight on iPhone, Google Play on Android. If your phone cannot run
          it, the store will tell you before you install.
        </p>
      </div>

      {form.platform === "ios" && (
        <div>
          <label htmlFor="appleIdEmail" className={labelStyle}>
            The email your iPhone&rsquo;s App Store uses
          </label>
          <input
            id="appleIdEmail"
            type="email"
            required
            autoComplete="email"
            value={form.appleIdEmail}
            onChange={(e) => update("appleIdEmail", e.target.value)}
            className={inputStyle}
            placeholder="you@icloud.com"
          />
          {/* Named by where to find it rather than by what Apple calls it. The
              first applicant wrote from one address and had her App Store on
              another, which is the normal case and the one that silently loses
              an invitation: the invite goes to the App Store address, so asking
              for "your email" would have got the wrong one. */}
          <p className={helperStyle}>
            Your invitation to install the app is sent here, so it has to be this one. To check:
            open Settings and tap your name at the top. It is the address underneath it.
          </p>
        </div>
      )}

      {form.platform === "android" && (
        <div>
          <label htmlFor="googleEmail" className={labelStyle}>
            The Google account your phone&rsquo;s Play Store uses
          </label>
          <input
            id="googleEmail"
            type="email"
            required
            autoComplete="email"
            value={form.googleEmail}
            onChange={(e) => update("googleEmail", e.target.value)}
            className={inputStyle}
            placeholder="you@gmail.com"
          />
          {/* Same trap as the Apple field, but it fails more quietly: Google
              never emails the tester, and a wrong account here just makes the
              tester page say the app is not available, with no clue why. */}
          <p className={helperStyle}>
            Access is tied to this exact account, so it has to be the one your phone is signed in
            with. To check: open the Play Store and tap your picture at the top right.
          </p>
        </div>
      )}


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
            // Changing the language has to drop the variant with it. The field
            // only hides, it does not clear, so someone who picked Colombia and
            // then switched to Portuguese used to submit Portuguese/colombia.
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                targetLanguage: e.target.value,
                targetVariant: "",
                targetVariantOther: "",
              }))
            }
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

      {/* A ancho completo y fuera de la rejilla de idiomas: colgada de la
          columna derecha dejaba media fila vacía a su izquierda. Solo para los
          idiomas con más de un sabor de contenido, obligatoria y sin nada
          preseleccionado: un valor por defecto es lo que todo el mundo deja
          sin tocar. */}
      {variantOptions && (
        <div>
          <label htmlFor="targetVariant" className={labelStyle}>
            Which variant?
          </label>
          <select
            id="targetVariant"
            required
            value={form.targetVariant}
            onChange={(e) => update("targetVariant", e.target.value)}
            className={selectStyle}
          >
            <option value="" disabled>
              Pick one
            </option>
            {variantOptions.map((v) => (
              <option key={v.label} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
          {form.targetVariant === "other" && (
            <input
              type="text"
              required
              value={form.targetVariantOther}
              onChange={(e) => update("targetVariantOther", e.target.value)}
              className={`${inputStyle} mt-2`}
              placeholder="Country or region"
              maxLength={60}
            />
          )}
        </div>
      )}
      {/* Un idioma escrito a mano no tiene lista de variantes que ofrecer,
          y es justo donde más falta hace saber cuál quiere: es contenido
          que todavía no existe. Texto libre, y obligatorio como el resto:
          media respuesta no sirve para decidir qué se escribe. */}
      {form.targetLanguage === "Other" && (
        <div>
          <label htmlFor="targetVariantFree" className={labelStyle}>
            Which variant?
          </label>
          <input
            id="targetVariantFree"
            type="text"
            required
            value={form.targetVariantOther}
            onChange={(e) => update("targetVariantOther", e.target.value)}
            className={inputStyle}
            placeholder="Country or region"
            maxLength={60}
          />
        </div>
      )}

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
        <span className={labelStyle}>Hours per week you&rsquo;ll dedicate</span>
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
          {BETA_MOTIVATIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {/* "Other" sin caja donde escribir es una opción que se traga la
            respuesta: la persona elige la etiqueta que menos le miente y no
            queda ni rastro de su razón. */}
        {form.motivation === "Other" && (
          <input
            type="text"
            required
            value={form.motivationOther}
            onChange={(e) => update("motivationOther", e.target.value)}
            className={`${inputStyle} mt-2`}
            placeholder="Tell us why"
            maxLength={200}
          />
        )}
      </div>

      {/* Un desplegable que AÑADE, no dieciséis chips: la lista completa a la
          vista alargaba la página media pantalla y la pregunta importa menos
          que las de arriba. Lo elegido se queda en pastillas que se quitan con
          un toque. El tope de cinco es donde marcar deja de significar algo:
          quien marca todo no ha elegido nada. */}
      <div>
        <label htmlFor="topicInterests" className={labelStyle}>
          What topics are you most interested in?
        </label>
        {form.topicInterests.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {form.topicInterests.map((slug) => (
              <button
                key={slug}
                type="button"
                onClick={() => toggleTopic(slug)}
                className="flex items-center gap-2 rounded-lg border border-[#fcd34d4d] bg-[#fcd34d1a] px-3 py-1.5 text-xs font-extrabold text-[#fcd34d]"
                aria-label={`Remove ${topicInterestLabel(slug)}`}
              >
                {topicInterestLabel(slug)}
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <path
                    d="M1 1l8 8M9 1L1 9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ))}
          </div>
        )}
        {form.topicInterests.length < MAX_TOPIC_INTERESTS && (
          <select
            id="topicInterests"
            value=""
            onChange={(e) => {
              if (e.target.value === "other") {
                setForm((prev) => ({ ...prev, topicInterestsOtherOpen: true }));
                return;
              }
              if (e.target.value) toggleTopic(e.target.value);
            }}
            className={selectStyle}
          >
            <option value="" disabled>
              {form.topicInterests.length === 0 ? "Pick one" : "Add another"}
            </option>
            {BETA_TOPIC_INTERESTS.filter((t) => !form.topicInterests.includes(t.slug)).map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
            <option value="other">Something else...</option>
          </select>
        )}
        {form.topicInterestsOtherOpen && (
          <input
            type="text"
            required
            value={form.topicInterestsOther}
            onChange={(e) => update("topicInterestsOther", e.target.value)}
            className={`${inputStyle} mt-2`}
            placeholder="Which topic?"
            maxLength={120}
          />
        )}
        <p className="mt-1.5 text-xs font-bold text-white/45">
          Up to {MAX_TOPIC_INTERESTS}. This is what we write next.
        </p>
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

      {/* Segunda casilla, opcional y desmarcada. La de arriba solo cubre el
          programa de beta: sin esta no se le puede mandar nada promocional
          cuando la beta termine. Se guarda como `marketingConsentAt`. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs font-bold leading-relaxed text-white/65">
        <input
          type="checkbox"
          checked={form.marketingConsent}
          onChange={(e) => update("marketingConsent", e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#fcd34d]"
        />
        <span>
          Optional: send me beta tester perks, like exclusive discounts and early news about the app.
          One email at a time, and you can unsubscribe whenever you want.
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
