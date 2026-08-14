"use client";

// The whole beta program on one screen. Five tabs, one data load.
//
// The organizing idea is that you should only ever have to look at two of
// these: Review (what the rules could not decide) and Feedback (what testers
// said). Everything else is there for when you want it, not because the
// program needs you.

import { useCallback, useEffect, useMemo, useState } from "react";

const ACCENT = "#14b8a6";

type Tab = "review" | "demand" | "testers" | "feedback" | "releases" | "rules";

/**
 * Silent capture from the browser at form mount: where they came from and
 * where they were. Never asked, so it is the only unbiased answer we get to
 * "what is actually bringing testers in".
 */
type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingUrl?: string;
  timezone?: string;
  country?: string;
  region?: string;
  city?: string;
  browserLanguage?: string;
  userAgent?: string;
};

type Applicant = {
  id: string;
  email: string;
  firstName: string | null;
  appleIdEmail: string | null;
  /** ios | android | both. Rows from before the form asked are "ios". */
  platform: string | null;
  googleEmail: string | null;
  socialHandle: string | null;
  nativeLanguage: string;
  targetLanguage: string;
  /**
   * País/región del idioma pedido. El formulario NO lo preguntaba hasta el
   * 2026-08-11, así que todo lo anterior es null: eso no es "les da igual",
   * es que nunca se les preguntó, y la subsección de demanda lo dice en vez
   * de contarlo como una preferencia.
   */
  targetVariant: string | null;
  currentLevel: string;
  hasIPhone: boolean;
  weeklyHours: string | null;
  motivation: string | null;
  referralSource: string | null;
  applicationReason: string | null;
  attribution: Attribution | null;
  currentApps: string | null;
  status: string;
  score: number | null;
  decision: string | null;
  decisionReason: string | null;
  notes: string | null;
  invitedAt: string | null;
  ascError: string | null;
  ascTesterId: string | null;
  clerkUserId: string | null;
  lastActiveAt: string | null;
  planGrantedAt: string | null;
  createdAt: string;
  _count?: { feedback: number };
  /** Real usage from UserMetric. Null until the tester has signed in. */
  usage?: {
    stories: number;
    audioPlays: number;
    audioCompletes: number;
    practice: number;
    lastEventAt: string | null;
  } | null;
  /**
   * What Apple holds, which is not the same thing as what we decided. Null
   * when we never registered them. GONE means Apple does not have the id we
   * stored; UNREACHABLE means we could not ask.
   */
  apple?: { state: string; group: string; isInternal: boolean } | null;
};

/**
 * What GOOGLE holds. Per track, not per tester, and that asymmetry with Apple
 * is real rather than an omission: Play grants access through membership of a
 * Google Group that no API can read, and it emails the tester nothing. So the
 * only thing that can be known is whether the track can serve anybody at all.
 */
type PlayState = {
  configured: boolean;
  packageName: string | null;
  track: string;
  /** Console-facing name, e.g. "Closed testing (alpha)". Comes from the API. */
  trackName: string;
  groupEmail: string | null;
  attachedGroups: string[];
  groupAttached: boolean;
  release: { status: string; name: string | null; versionCodes: string[] } | null;
  optInUrl: string | null;
  groupJoinUrl: string | null;
  blockers: string[];
  error: string | null;
};

function isAndroid(a: Applicant): boolean {
  const p = (a.platform ?? "ios").toLowerCase();
  return p === "android" || p === "both";
}

/**
 * Our status and Apple's state disagree in a way that hurts the tester.
 *
 * The case this exists for: we say `invited`, so the panel is green and the
 * acceptance email has gone out telling them to look for a message from Apple,
 * while Apple still has them at NOT_INVITED and has sent nothing. That is
 * silent from every angle except this one.
 */
function appleAlarm(a: Applicant): string | null {
  if (!a.ascTesterId) {
    return a.status === "invited" || a.status === "accepted"
      ? "Marked as invited, but never registered with Apple."
      : null;
  }
  const state = a.apple?.state;
  if (!state || state === "UNREACHABLE") return null;
  if (state === "GONE") return "Apple does not recognise the tester id we stored.";
  if (state === "NOT_INVITED") return "Apple has not sent the invitation. They are waiting for an email that does not exist.";
  return null;
}

/**
 * The Android counterpart, and it can only ever fire for the whole cohort at
 * once. There is no per-tester Google state to contradict us with, so the
 * failure it catches is the one that actually happened on 2026-08-05: a tester
 * holding a link to a track that has nothing published on it, seeing an empty
 * grey card and concluding the app is broken.
 */
function playAlarm(a: Applicant, play: PlayState | null): string | null {
  if (!isAndroid(a) || !play) return null;
  if (a.status !== "invited" && a.status !== "accepted") return null;
  if (play.blockers.length === 0) return null;
  return `Android access is not working: ${play.blockers[0]}`;
}

function storeAlarm(a: Applicant, play: PlayState | null): string | null {
  // iOS first: for a `both` tester the TestFlight path is the one we actually
  // invited them down, so an Apple contradiction is the more direct problem.
  return appleAlarm(a) ?? playAlarm(a, play);
}

type Feedback = {
  id: string;
  email: string;
  kind: string;
  rating: number | null;
  message: string;
  screen: string | null;
  platform: string;
  appVersion: string | null;
  buildNumber: string | null;
  deviceModel: string | null;
  osVersion: string | null;
  status: string;
  adminNotes: string | null;
  releaseId: string | null;
  createdAt: string;
  signup: { id: string; firstName: string | null; email: string } | null;
};

type Release = {
  id: string;
  platform: string;
  version: string;
  buildNumber: string;
  headline: string;
  whatsNew: string[];
  knownIssues: string[] | null;
  askThem: string | null;
  status: string;
  publishedAt: string | null;
  notifiedCount: number;
  createdAt: string;
};

type Rules = {
  autoAcceptAt: number;
  autoDeclineBelow: number;
  maxActiveTesters: number;
  acceptedTargetLanguages: string[];
  autoInviteEnabled: boolean;
  betaEndsAt: string | null;
  launchedAt: string | null;
  appStoreReviewUrl: string | null;
  installNudgeAfterDays: number;
  feedbackAskAfterDays: number;
  midSurveyAfterDays: number;
  finalSurveyBeforeEndDays: number;
  reviewAskMinRating: number;
};

type Payload = {
  applicants: Applicant[];
  feedback: Feedback[];
  releases: Release[];
  rules: Rules;
  stats: { activeTesters: number; byStatus: Record<string, number>; openFeedback: number };
  /** False when Apple could not be reached, so every `apple` field is a blank
   *  rather than a fact. The counters say "?" instead of zero on purpose. */
  appleReachable: boolean;
  /** Rows hidden because they are our own test artifacts. Shown as a footnote
   *  so a filtered panel never passes for a complete one. */
  hiddenTestRows: number;
  play: PlayState | null;
  health: { ok: true; groups: Array<{ id: string; name: string; internal: boolean }> } | { ok: false; error: string } | null;
};

/* ── shared styles, matching the rest of Studio ── */

const card: React.CSSProperties = {
  borderRadius: 10,
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  padding: "14px 16px",
};

const btn: React.CSSProperties = {
  height: 32,
  borderRadius: 6,
  border: "none",
  backgroundColor: ACCENT,
  color: "#fff",
  padding: "0 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  ...btn,
  backgroundColor: "transparent",
  border: "1px solid var(--card-border)",
  color: "var(--muted)",
};

const dangerBtn: React.CSSProperties = { ...ghostBtn, color: "#f87171", borderColor: "#f8717155" };

const inputStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  padding: "0 10px",
  fontSize: 13,
  outline: "none",
  width: "100%",
};

const areaStyle: React.CSSProperties = { ...inputStyle, height: 80, padding: "8px 10px", lineHeight: 1.5 };

const STATUS_COLORS: Record<string, string> = {
  pending: "#fbbf24",
  waitlist: "#a78bfa",
  invited: "#60a5fa",
  accepted: "#34d399",
  declined: "#f87171",
  new: "#fbbf24",
  triaged: "#a78bfa",
  in_progress: "#60a5fa",
  fixed: "#34d399",
  wont_fix: "#9aa7bd",
  duplicate: "#9aa7bd",
  draft: "#fbbf24",
  published: "#34d399",
};

function pill(value: string): React.CSSProperties {
  const color = STATUS_COLORS[value] ?? "#9aa7bd";
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: `${color}26`,
    color,
    whiteSpace: "nowrap",
  };
}

// Apple's own vocabulary, kept rather than translated into ours. Reading
// INSTALLED here and INSTALLED in App Store Connect should be the same act;
// a friendlier synonym would make the two impossible to reconcile when
// something looks wrong.
const APPLE_STATE_COLORS: Record<string, string> = {
  INSTALLED: "#34d399",
  ACCEPTED: "#60a5fa",
  INVITED: "#fbbf24",
  NOT_INVITED: "#f87171",
  GONE: "#f87171",
  UNREACHABLE: "#9aa7bd",
};

function appleLabel(state: string): string {
  if (state === "UNREACHABLE") return "Apple unreachable";
  if (state === "GONE") return "unknown to Apple";
  return `Apple: ${state.toLowerCase().replace(/_/g, " ")}`;
}

/**
 * Deliberately never says a tester is installed, accepted or invited on
 * Android, because Google does not tell us any of those things. It describes
 * the track, and the wording says so, so the pill cannot be misread as a
 * per-person confirmation the way a green "invited" would be.
 */
function playLabel(play: PlayState | null): string {
  if (!play) return "Play unknown";
  if (!play.configured) return "Play not configured";
  if (play.error) return "Play unreachable";
  if (!play.groupEmail) return "Play: no group set";
  if (!play.groupAttached) return "Play: group not on track";
  if (!play.release) return `Play: no build on ${play.track}`;
  return `Play: ${play.track} ready`;
}

function playPillStyle(play: PlayState | null): React.CSSProperties {
  const ok = Boolean(play && play.configured && !play.error && play.blockers.length === 0);
  const color = !play || !play.configured ? "#9aa7bd" : ok ? "#34d399" : "#f87171";
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: `${color}26`,
    color,
    whiteSpace: "nowrap",
  };
}

function applePill(state: string | undefined): React.CSSProperties {
  const color = state ? (APPLE_STATE_COLORS[state] ?? "#9aa7bd") : "#9aa7bd";
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: `${color}26`,
    color,
    whiteSpace: "nowrap",
  };
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  // Para lo de hoy, la hora exacta: la fecha ya está escrita al lado, así que
  // "today" no añadía nada, y cuando entran varias solicitudes seguidas lo
  // único que importa es a qué hora llegó cada una.
  if (days <= 0) {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── Demanda ────────────────────────────────────────────────────────────
// Quién quiere qué, contado sobre TODAS las solicitudes, no solo sobre la
// cola. La pregunta que contesta no es "a quién invito hoy" sino "qué merece
// la pena construir": un idioma con veinte personas esperando y sin contenido
// es una decisión de producto, y hasta ahora ese número no estaba en ninguna
// pantalla. Nada aquí es accionable por sí solo, a propósito.

/** Cuenta ocurrencias y las devuelve de mayor a menor. */
function tally<T>(rows: T[], pick: (row: T) => string | null | undefined): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = pick(row);
    const key = (raw ?? "").trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const FLAG_BY_COUNTRY: Record<string, string> = {
  US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", ES: "🇪🇸", FR: "🇫🇷", IT: "🇮🇹", PT: "🇵🇹", BR: "🇧🇷",
  NL: "🇳🇱", BE: "🇧🇪", IE: "🇮🇪", CA: "🇨🇦", AU: "🇦🇺", NZ: "🇳🇿", MX: "🇲🇽", AR: "🇦🇷",
  CO: "🇨🇴", CL: "🇨🇱", PE: "🇵🇪", CH: "🇨🇭", AT: "🇦🇹", SE: "🇸🇪", NO: "🇳🇴", DK: "🇩🇰",
  FI: "🇫🇮", PL: "🇵🇱", CZ: "🇨🇿", GR: "🇬🇷", JP: "🇯🇵", KR: "🇰🇷", IN: "🇮🇳", ZA: "🇿🇦",
};

/** Una barra por fila: la proporción se lee antes que el número. */
function DemandBars({
  rows,
  total,
  empty,
  renderLabel,
}: {
  rows: Array<[string, number]>;
  total: number;
  empty: string;
  renderLabel?: (key: string) => React.ReactNode;
}) {
  if (rows.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--muted)" }}>{empty}</div>;
  }
  const top = rows[0][1];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map(([key, n]) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, width: 132, flexShrink: 0, color: "var(--foreground)" }}>
            {renderLabel ? renderLabel(key) : key}
          </span>
          <span
            style={{
              flex: 1,
              height: 7,
              borderRadius: 999,
              backgroundColor: "var(--card-border)",
              overflow: "hidden",
              minWidth: 40,
            }}
          >
            <span
              style={{
                display: "block",
                width: `${Math.max(4, (n / top) * 100)}%`,
                height: "100%",
                backgroundColor: ACCENT,
              }}
            />
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)", width: 62, textAlign: "right", flexShrink: 0 }}>
            {n} · {Math.round((n / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function DemandBlock({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section style={card}>
      <h3 style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700 }}>{title}</h3>
      {hint && <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "var(--muted)" }}>{hint}</p>}
      {children}
    </section>
  );
}

function DemandPanel({ applicants, servedLanguages }: { applicants: Applicant[]; servedLanguages: string[] }) {
  const total = applicants.length;
  if (total === 0) {
    return <div style={{ ...card, fontSize: 13, color: "var(--muted)" }}>Todavía no hay solicitudes.</div>;
  }

  const served = new Set(servedLanguages.map((l) => l.trim().toLowerCase()));
  const byLanguage = tally(applicants, (a) => a.targetLanguage);
  // La región solo tiene sentido dentro de su idioma: "brazil" no significa
  // nada suelto. Y se cuenta aparte cuántos no la eligieron NUNCA, porque a
  // esos no se les preguntó y contarlos como "sin preferencia" sería mentir.
  const variantsByLanguage = new Map<string, { rows: Array<[string, number]>; unasked: number }>();
  for (const [language] of byLanguage) {
    const rows = applicants.filter((a) => a.targetLanguage === language);
    variantsByLanguage.set(language, {
      rows: tally(rows, (a) => a.targetVariant),
      unasked: rows.filter((a) => !a.targetVariant).length,
    });
  }

  const waiting = applicants.filter((a) => a.status === "waitlist" || a.status === "pending");
  const unservedWaiting = tally(
    waiting.filter((a) => !served.has(a.targetLanguage.trim().toLowerCase())),
    (a) => a.targetLanguage
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...card, fontSize: 12.5, color: "var(--muted)" }}>
        {total} solicitudes en total · {waiting.length} todavía esperando. Los porcentajes son sobre el total,
        no sobre los que quedan.
      </div>

      <DemandBlock
        title="Qué idioma quieren"
        hint="En verde los idiomas que las reglas aceptan hoy. Los demás van a la lista de espera aunque tengan contenido publicado, que es el caso del portugués."
      >
        <DemandBars
          rows={byLanguage}
          total={total}
          empty="—"
          renderLabel={(key) => (
            <span style={{ color: served.has(key.toLowerCase()) ? ACCENT : "var(--foreground)" }}>
              {key}
              {!served.has(key.toLowerCase()) && (
                <span style={{ color: "var(--muted)", fontSize: 10.5 }}> · no lo aceptan las reglas</span>
              )}
            </span>
          )}
        />
      </DemandBlock>

      <DemandBlock
        title="Y de qué país, cuando lo dijeron"
        hint="El formulario no preguntaba el país del idioma hasta el 11 ago 2026; lo anterior no es indiferencia, es que nadie se lo preguntó."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {byLanguage.map(([language, n]) => {
            const v = variantsByLanguage.get(language);
            if (!v) return null;
            return (
              <div key={language}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                  {language}{" "}
                  <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                    · {n} {n === 1 ? "persona" : "personas"}
                    {v.unasked > 0 && ` · ${v.unasked} sin preguntar`}
                  </span>
                </div>
                <DemandBars
                  rows={v.rows}
                  total={n}
                  empty="a nadie de este idioma se le llegó a preguntar el país"
                />
              </div>
            );
          })}
        </div>
      </DemandBlock>

      {unservedWaiting.length > 0 && (
        <DemandBlock
          title="Esperando un idioma que las reglas no aceptan"
          hint="Gente en la cola cuyo idioma queda fuera antes incluso de puntuarse. Aquí es donde se ve si una regla está reteniendo a alguien que ya podrías atender."
        >
          <DemandBars rows={unservedWaiting} total={waiting.length} empty="—" />
        </DemandBlock>
      )}

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <DemandBlock title="De dónde son">
          <DemandBars
            rows={tally(applicants, (a) => a.attribution?.country)}
            total={total}
            empty="sin datos de país"
            renderLabel={(key) => `${FLAG_BY_COUNTRY[key.toUpperCase()] ?? "🏳"} ${key}`}
          />
        </DemandBlock>

        <DemandBlock title="Con qué teléfono">
          <DemandBars rows={tally(applicants, (a) => a.platform ?? "ios")} total={total} empty="—" />
        </DemandBlock>

        <DemandBlock title="Desde qué nivel empiezan">
          <DemandBars rows={tally(applicants, (a) => a.currentLevel)} total={total} empty="—" />
        </DemandBlock>

        <DemandBlock title="Cuánto tiempo dicen tener" hint="A la semana.">
          <DemandBars rows={tally(applicants, (a) => a.weeklyHours)} total={total} empty="sin respuesta" />
        </DemandBlock>

        <DemandBlock title="Para qué lo quieren">
          <DemandBars rows={tally(applicants, (a) => a.motivation)} total={total} empty="sin respuesta" />
        </DemandBlock>

        <DemandBlock title="Por dónde llegaron">
          <DemandBars rows={tally(applicants, (a) => a.referralSource)} total={total} empty="sin respuesta" />
        </DemandBlock>

        <DemandBlock title="Qué idioma hablan ya">
          <DemandBars rows={tally(applicants, (a) => a.nativeLanguage)} total={total} empty="—" />
        </DemandBlock>

        <DemandBlock title="En qué huso horario están" hint="Para saber a qué hora escribirles.">
          <DemandBars rows={tally(applicants, (a) => a.attribution?.timezone)} total={total} empty="sin datos" />
        </DemandBlock>
      </div>
    </div>
  );
}

/** One usage number with its label, sized so a row of them scans at a glance. */
function Metric({ n, label }: { n: number; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
      <b style={{ fontSize: 15, color: n > 0 ? ACCENT : "var(--muted)" }}>{n}</b>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
    </span>
  );
}

/** Absolute date, for when "8d ago" is not the question being asked. */
function onDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * The answers they actually gave, rendered the same way wherever an applicant
 * appears. It used to exist only inside the review queue, so the moment you
 * invited someone their whole application vanished from the panel: the tester
 * card showed a language and nothing else, and the one field that predicts
 * whether they will test anything (what they wrote about why they applied)
 * was only ever visible in the seconds before you clicked Invite.
 */
function ApplicationSummary({ a, showReason }: { a: Applicant; showReason: boolean }) {
  return (
    <>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
        {a.targetLanguage} · {a.currentLevel} · {a.weeklyHours ?? "?"} hrs/wk ·{" "}
        {a.motivation ?? "?"} · via {a.referralSource ?? "?"}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
        applied {onDate(a.createdAt)} ({ago(a.createdAt)})
        {a.invitedAt ? ` · invited ${onDate(a.invitedAt)} (${ago(a.invitedAt)})` : ""}
      </div>
      {showReason && a.applicationReason && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 8,
            backgroundColor: "var(--background)",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {a.applicationReason}
        </div>
      )}
    </>
  );
}

/**
 * The triage score with its scale attached. A bare "51" in the corner of a
 * card is a number nobody can act on: it needs the denominator to be read as
 * a proportion, and the band it landed in to explain why the row is sitting
 * in the queue rather than invited or declined.
 */
function ScoreBadge({ score, rules }: { score: number | null; rules: Rules | null }) {
  if (score === null) {
    return <span style={{ fontSize: 20, fontWeight: 800, color: "var(--muted)" }}>-</span>;
  }
  const band =
    rules && score >= rules.autoAcceptAt
      ? "clears the auto-invite bar"
      : rules && score < rules.autoDeclineBelow
        ? "below the decline floor"
        : "in the review band";
  return (
    <span
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.1 }}
      title={`Triage score ${score} of 100: ${band}. Built from the application text, weekly hours, target language, motivation and referral source.`}
    >
      <span style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>
        {score}
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>/100</span>
      </span>
      <span style={{ ...labelStyle(), fontSize: 9 }}>score</span>
    </span>
  );
}

function labelStyle(): React.CSSProperties {
  return { fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" };
}

/* ── attribution: where they came from, never asked ── */

/** ISO 3166-1 alpha-2 to flag emoji, each letter offset to its indicator. */
function countryFlag(code?: string): string {
  if (!code || code.length !== 2) return "";
  const A = 0x1f1e6;
  const baseA = "A".charCodeAt(0);
  const a = code.toUpperCase().charCodeAt(0);
  const b = code.toUpperCase().charCodeAt(1);
  if (a < baseA || a > baseA + 25 || b < baseA || b > baseA + 25) return "";
  return String.fromCodePoint(A + (a - baseA)) + String.fromCodePoint(A + (b - baseA));
}

function formatLocation(attr: Attribution | null): string | null {
  if (!attr) return null;
  const parts = [attr.city, attr.region, attr.country].filter(Boolean);
  if (parts.length === 0) return null;
  return [countryFlag(attr.country), parts.join(", ")].filter(Boolean).join(" ");
}

function shortHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url.length > 40 ? `${url.slice(0, 40)}...` : url;
  }
}

/** The campaign if there was one, the referring host otherwise, nothing if direct. */
function formatSource(attr: Attribution | null): string | null {
  if (!attr) return null;
  if (attr.utmSource) {
    return [attr.utmSource, attr.utmMedium, attr.utmCampaign].filter(Boolean).join("/");
  }
  return attr.referrer ? shortHost(attr.referrer) : null;
}

/** Location and source on one muted line. Absent rather than blank when unknown. */
function AttributionLine({ attr }: { attr: Attribution | null }) {
  const location = formatLocation(attr);
  const source = formatSource(attr);
  if (!location && !source) return null;
  return (
    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
      {location}
      {location && source && " · "}
      {source && (
        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11 }}>
          via {source}
        </span>
      )}
    </div>
  );
}

/**
 * Admin notes, one line until you click it. Writes through the same `note`
 * action the automation uses, so there is no second path to this column.
 */
function NotesField({
  applicant,
  busy,
  onAction,
}: {
  applicant: Applicant;
  busy: string | null;
  onAction: (id: string, action: string, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!editing) {
    return (
      <div
        style={{
          fontSize: 12,
          marginTop: 8,
          cursor: "pointer",
          whiteSpace: "pre-wrap",
          color: applicant.notes ? "var(--foreground)" : "var(--muted)",
        }}
        onClick={() => {
          setDraft(applicant.notes ?? "");
          setEditing(true);
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--muted)" }}>Notes: </span>
        {applicant.notes || "click to add"}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <textarea
        style={{ ...areaStyle, height: 56, flex: 1, fontSize: 12 }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          style={{ ...btn, height: 26, fontSize: 11 }}
          disabled={busy === applicant.id}
          onClick={async () => {
            await onAction(applicant.id, "note", { notes: draft });
            setEditing(false);
          }}
        >
          Save
        </button>
        <button
          style={{ ...ghostBtn, height: 26, fontSize: 11, padding: "0 8px" }}
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── component ── */

export default function BetaProgramClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("review");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async (withHealth = false) => {
    try {
      const res = await fetch(`/api/studio/beta${withHealth ? "?health=1" : ""}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const say = useCallback((msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 6000);
  }, []);

  const applicantAction = useCallback(
    async (id: string, action: string, extra: Record<string, unknown> = {}) => {
      setBusy(id);
      try {
        const res = await fetch("/api/studio/beta/applicants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, ...extra }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? json.inviteError ?? `HTTP ${res.status}`);
        say(`Done: ${action}`);
        await load();
      } catch (err) {
        say(`Failed: ${String(err)}`);
      } finally {
        setBusy(null);
      }
    },
    [load, say],
  );

  /**
   * Spam cleanup, and the only destructive control on this screen. Separate
   * from `decline`, which is a decision about a real person and sends them an
   * email: this one is for rows that were never an application.
   */
  const applicantDelete = useCallback(
    async (id: string, email: string) => {
      if (!confirm(`Delete the application from ${email}? This cannot be undone.`)) return;
      setBusy(id);
      try {
        const res = await fetch("/api/studio/beta/applicants", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        say(`Deleted ${email}`);
        await load();
      } catch (err) {
        say(`Failed: ${String(err)}`);
      } finally {
        setBusy(null);
      }
    },
    [load, say],
  );

  const feedbackPatch = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      setBusy(id);
      try {
        const res = await fetch("/api/studio/beta/feedback", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...patch }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
        await load();
      } catch (err) {
        say(`Failed: ${String(err)}`);
      } finally {
        setBusy(null);
      }
    },
    [load, say],
  );

  // Every applicant, flat, for reading outside this screen. Attribution columns
  // included: they are the reason anyone exports this rather than screenshotting
  // the queue.
  function exportCsv(applicants: Applicant[]) {
    const header = [
      "email",
      "firstName",
      "platform",
      "nativeLanguage",
      "targetLanguage",
      "currentLevel",
      "weeklyHours",
      "motivation",
      "referralSource",
      "applicationReason",
      "score",
      "status",
      "decision",
      "notes",
      "country",
      "city",
      "utmSource",
      "utmMedium",
      "utmCampaign",
      "referrer",
      "landingUrl",
      "invitedAt",
      "createdAt",
    ];
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [header.join(",")];
    for (const a of applicants) {
      const attr = a.attribution ?? {};
      lines.push(
        [
          a.email,
          a.firstName,
          a.platform ?? "ios",
          a.nativeLanguage,
          a.targetLanguage,
          a.currentLevel,
          a.weeklyHours,
          a.motivation,
          a.referralSource,
          a.applicationReason,
          a.score,
          a.status,
          a.decision,
          a.notes,
          attr.country,
          attr.city,
          attr.utmSource,
          attr.utmMedium,
          attr.utmCampaign,
          attr.referrer,
          attr.landingUrl,
          a.invitedAt,
          a.createdAt,
        ]
          .map(escape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `beta-applicants-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div style={{ color: "var(--muted)", padding: 24 }}>Loading the beta program...</div>;
  if (error) return <div style={{ color: "#f87171", padding: 24 }}>{error}</div>;
  if (!data) return null;

  const needsReview = data.applicants.filter((a) => a.status === "waitlist" || a.status === "pending");
  const testers = data.applicants.filter((a) => a.status === "invited" || a.status === "accepted");

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "review", label: "Review queue", count: needsReview.length },
    { key: "demand", label: "Demand", count: data.applicants.length },
    { key: "testers", label: "Testers", count: testers.length },
    { key: "feedback", label: "Feedback", count: data.stats.openFeedback },
    { key: "releases", label: "Build notes", count: data.releases.length },
    { key: "rules", label: "Rules" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StatBar
        stats={data.stats}
        rules={data.rules}
        applicants={data.applicants}
        appleReachable={data.appleReachable}
        play={data.play}
      />

      {flash && (
        <div style={{ ...card, borderColor: ACCENT, color: "var(--foreground)", fontSize: 13 }}>{flash}</div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...ghostBtn,
              backgroundColor: tab === t.key ? `${ACCENT}22` : "transparent",
              borderColor: tab === t.key ? ACCENT : "var(--card-border)",
              color: tab === t.key ? ACCENT : "var(--muted)",
            }}
          >
            {t.label}
            {t.count !== undefined && ` (${t.count})`}
          </button>
        ))}
        <button
          style={{ ...ghostBtn, marginLeft: "auto" }}
          disabled={data.applicants.length === 0}
          onClick={() => exportCsv(data.applicants)}
        >
          Export CSV
        </button>
      </div>

      {data.hiddenTestRows > 0 && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: -4 }}>
          {data.hiddenTestRows} test row{data.hiddenTestRows === 1 ? "" : "s"} hidden.
        </div>
      )}

      {tab === "review" && (
        <ReviewQueue
          applicants={needsReview}
          rules={data.rules}
          busy={busy}
          onAction={applicantAction}
          onDelete={applicantDelete}
        />
      )}

      {tab === "demand" && (
        // "Servido" = idioma que las reglas aceptan hoy. No es lo mismo que
        // "tiene contenido", pero es la línea que decide quién entra, y por
        // eso es la que se pinta.
        <DemandPanel applicants={data.applicants} servedLanguages={data.rules.acceptedTargetLanguages} />
      )}

      {tab === "testers" && (
        <>
          <PlayTrackPanel play={data.play} onDone={load} />
          <Testers testers={testers} busy={busy} onAction={applicantAction} play={data.play} />
        </>
      )}

      {tab === "feedback" && (
        <FeedbackList
          feedback={data.feedback}
          releases={data.releases}
          busy={busy}
          onPatch={feedbackPatch}
        />
      )}

      {tab === "releases" && (
        <Releases releases={data.releases} onChanged={load} say={say} testerCount={testers.length} />
      )}

      {tab === "rules" && (
        <RulesPanel rules={data.rules} health={data.health} onReload={load} say={say} />
      )}
    </div>
  );
}

/* ── stat bar ── */

function StatBar({
  stats,
  rules,
  applicants,
  appleReachable,
  play,
}: {
  stats: Payload["stats"];
  rules: Rules;
  applicants: Applicant[];
  appleReachable: boolean;
  play: PlayState | null;
}) {
  // Surfaced at the top rather than only inside the Testers tab, because the
  // failure it names is invisible everywhere else: for a tester stuck at
  // NOT_INVITED every other indicator on this page reads perfectly healthy.
  const blocked = applicants.filter((a) => appleAlarm(a) !== null).length;
  // Its own tile rather than folded into the Apple count. The two fail for
  // opposite reasons: Apple blocks one tester at a time, Google blocks the
  // whole Android cohort at once, and a single merged number would hide which
  // of those is happening.
  const blockedAndroid = applicants.filter((a) => playAlarm(a, play) !== null).length;

  const waiting = (stats.byStatus.waitlist ?? 0) + (stats.byStatus.pending ?? 0);

  // "Holding an invite" and "actually opening the app" are different numbers,
  // and only the second one answers whether the beta is working. The old tile
  // showed `7 / 20`, which was the first number over a ceiling that does not
  // apply: the cap is only consulted by auto-invite, and the manual Invite
  // button never looks at it. So it read as a limit while nothing was limited.
  const using = applicants.filter((a) => (a.usage?.lastEventAt ?? null) !== null).length;

  const items: Array<{ label: string; value: string; alarm?: boolean; primary?: boolean }> = [
    { label: "Needs review", value: String(waiting), primary: waiting > 0 },
    { label: "Testers", value: `${using} using · ${stats.activeTesters} invited` },
    { label: "Open feedback", value: String(stats.openFeedback), primary: stats.openFeedback > 0 },
  ];

  // The cap is a ceiling on the automation. While the automation is off it
  // bounds nothing, so showing it is noise dressed as a constraint.
  if (rules.autoInviteEnabled) {
    items.push({ label: "Tester cap", value: `${stats.activeTesters} / ${rules.maxActiveTesters}` });
  }

  // Only ever shown when there is something to act on. These used to render
  // "?" for two different non-answers: Apple's map is empty when nobody is
  // registered with Apple at all, and Google's is unset simply because Play is
  // not configured. A permanent "?" in an alarm slot trains you to ignore it.
  if (blocked > 0) items.push({ label: "Blocked at Apple", value: String(blocked), alarm: true });
  if (blockedAndroid > 0) {
    items.push({ label: "Blocked at Google", value: String(blockedAndroid), alarm: true });
  }
  if (!appleReachable && applicants.some((a) => a.ascTesterId)) {
    items.push({ label: "Apple", value: "unreachable", alarm: true });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* The state of the program in one line. Auto-invite used to be the last
          and quietest tile while being the reason nobody moves off the
          waitlist; it belongs in the sentence that explains the page. */}
      <div
        style={{
          ...card,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          fontSize: 13,
          color: "var(--foreground)",
        }}
      >
        <span
          style={{
            fontWeight: 800,
            color: rules.autoInviteEnabled ? ACCENT : "#fbbf24",
          }}
        >
          Auto-invite {rules.autoInviteEnabled ? "on" : "off"}
        </span>
        <span style={{ color: "var(--muted)" }}>·</span>
        <span>
          {waiting} waiting
          {rules.autoInviteEnabled
            ? ""
            : " · nobody gets in until you invite them by hand"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        {items.map((i) => (
          <div
            key={i.label}
            style={i.alarm ? { ...card, borderColor: "#f8717155", backgroundColor: "#f8717110" } : card}
          >
            <div style={labelStyle()}>{i.label}</div>
            <div
              style={{
                fontSize: i.primary ? 28 : 22,
                fontWeight: 800,
                marginTop: 4,
                color: i.alarm ? "#f87171" : i.primary ? ACCENT : undefined,
              }}
            >
              {i.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── android track state ── */

/**
 * The Android third state, shown once above the tester list instead of once
 * per row, because that is the shape of the truth: there is no per-tester
 * Google state to show.
 *
 * It exists because of a specific failure. On 2026-08-05 a tester was sent a
 * Play testing link and got an empty grey card, and answering "why" took an
 * API probe: the link was fine, the track had a build, and she was simply
 * opening it inside the Play Store app instead of a browser. Every fact needed
 * to reach that answer in ten seconds is on this card.
 */
function PlayTrackPanel({ play, onDone }: { play: PlayState | null; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!play) return null;

  const ok = play.configured && !play.error && play.blockers.length === 0;

  async function attach() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/studio/beta?target=play", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; changed?: boolean };
      setMsg(
        res.ok
          ? body.changed
            ? "Group attached to the track."
            : "The group was already on the track."
          : `Failed: ${body.error ?? res.status}`,
      );
      if (res.ok) onDone();
    } catch (err) {
      setMsg(`Failed: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...card, borderColor: ok ? "var(--card-border)" : "#f8717155" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Android access{" "}
            <span style={playPillStyle(play)}>{playLabel(play)}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {play.packageName ?? "no package"} · {play.trackName ?? play.track} ·{" "}
            {play.release
              ? `build ${play.release.versionCodes.join(", ") || "?"} (${play.release.status})`
              : "no build published"}
          </div>
          {/* Stated on the panel, not just in a comment, because the natural
              reading of a beta panel is that a green row means a given person
              is in. On Android nobody can know that. */}
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>
            Google never reports who joined and never emails the tester. This describes the track,
            not any one person.
          </div>
          {play.blockers.length > 0 && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: "#f87171" }}>
              {play.blockers.map((b) => (
                <li key={b} style={{ marginBottom: 3 }}>
                  {b}
                </li>
              ))}
            </ul>
          )}
          {msg && <div style={{ fontSize: 12, marginTop: 8, color: "var(--muted)" }}>{msg}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          {play.groupEmail && !play.groupAttached && (
            <button style={btn} disabled={busy} onClick={attach}>
              {busy ? "Attaching..." : "Attach group to track"}
            </button>
          )}
          {play.groupJoinUrl && (
            <a
              href={play.groupJoinUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11, color: ACCENT }}
            >
              Testers group
            </a>
          )}
          {play.optInUrl && (
            <a
              href={play.optInUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11, color: ACCENT }}
            >
              Opt-in link
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── review queue ── */

function ReviewQueue({
  applicants,
  rules,
  busy,
  onAction,
  onDelete,
}: {
  applicants: Applicant[];
  rules: Rules;
  busy: string | null;
  onAction: (id: string, action: string, extra?: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string, email: string) => Promise<void>;
}) {
  if (applicants.length === 0) {
    return (
      <div style={{ ...card, color: "var(--muted)", fontSize: 13 }}>
        Nothing waiting. The rules handled everything that came in.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {applicants.map((a) => (
        <div key={a.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 240 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {a.firstName ?? "(no name)"} <span style={{ color: "var(--muted)", fontWeight: 500 }}>{a.email}</span>
              </div>
              <ApplicationSummary a={a} showReason={false} />
              <AttributionLine attr={a.attribution} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={pill(a.status)}>{a.status}</span>
              <ScoreBadge score={a.score} rules={rules} />
            </div>
          </div>

          {a.decisionReason && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>
              Rules said: {a.decisionReason}
            </div>
          )}

          {a.ascError && (
            <div style={{ fontSize: 12, color: "#f87171", marginTop: 8 }}>
              App Store Connect: {a.ascError}
            </div>
          )}

          {a.applicationReason && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 8,
                backgroundColor: "var(--background)",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {a.applicationReason}
            </div>
          )}

          {/* Legacy free-text field from the old form. Kept because the rows
              that have it are our earliest applicants. */}
          {a.currentApps && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              <span style={{ fontWeight: 700 }}>Apps: </span>
              {a.currentApps}
            </div>
          )}

          <NotesField applicant={a} busy={busy} onAction={onAction} />

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button style={btn} disabled={busy === a.id} onClick={() => onAction(a.id, "invite")}>
              {busy === a.id ? "Working..." : "Invite to TestFlight"}
            </button>
            <button style={ghostBtn} disabled={busy === a.id} onClick={() => onAction(a.id, "retriage")}>
              Re-run rules
            </button>
            <button style={dangerBtn} disabled={busy === a.id} onClick={() => onAction(a.id, "decline")}>
              Decline
            </button>
            {/* Deliberately last and unstyled as an action: declining writes to
                a person, deleting says there was never a person here. */}
            <button
              style={{ ...ghostBtn, marginLeft: "auto", fontSize: 11 }}
              disabled={busy === a.id}
              onClick={() => onDelete(a.id, a.email)}
              title="Spam only. Removes the row without emailing anyone."
            >
              Delete (spam)
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── testers ── */

function Testers({
  testers,
  busy,
  onAction,
  play,
}: {
  testers: Applicant[];
  busy: string | null;
  onAction: (id: string, action: string, extra?: Record<string, unknown>) => Promise<void>;
  play: PlayState | null;
}) {
  if (testers.length === 0) {
    return <div style={{ ...card, color: "var(--muted)", fontSize: 13 }}>No testers yet.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {testers.map((t) => {
        // An invite that was accepted but never signed in is the single most
        // common silent failure in a beta, so it is called out by name.
        //
        // Trustworthy only because the API repairs missing Clerk links before
        // it answers (backfillBetaTesterLinks). While that link depended on a
        // webhook that never fired, this flag was on for every tester in the
        // program, including the ones reading stories that afternoon.
        const stalled = t.status === "invited" && !t.clerkUserId;
        // An outright contradiction with Apple outranks "invited but idle":
        // one means they cannot get in at all, the other that they have not
        // bothered yet.
        const alarm = storeAlarm(t, play);
        return (
          <div
            key={t.id}
            style={{
              ...card,
              borderColor: alarm ? "#f8717155" : stalled ? "#fbbf2455" : "var(--card-border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {t.firstName ?? "(no name)"}{" "}
                  <span style={{ color: "var(--muted)", fontWeight: 500 }}>{t.email}</span>
                </div>
                <ApplicationSummary a={t} showReason />
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                  {t._count?.feedback ?? 0} reports
                </div>
                <AttributionLine attr={t.attribution} />
                {/* What they actually did, not just that they opened the app.
                    Absent until they sign in, which is itself the signal. */}
                {t.usage ? (
                  <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                    <Metric n={t.usage.stories} label="stories" />
                    <Metric n={t.usage.audioPlays} label="plays" />
                    <Metric n={t.usage.audioCompletes} label="finished" />
                    <Metric n={t.usage.practice} label="practice" />
                    <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "flex-end" }}>
                      last used {ago(t.usage.lastEventAt)}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>
                    No account found for this address, so there is nothing to
                    measure yet.
                  </div>
                )}
                {alarm && (
                  <div style={{ fontSize: 12, color: "#f87171", marginTop: 4, fontWeight: 600 }}>
                    {alarm}
                  </div>
                )}
                {stalled && !alarm && (
                  <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 4 }}>
                    Invited but never created an account. The lifecycle cron
                    will nudge them.
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Two pills, deliberately side by side: ours and Apple's. A
                    single merged status would have to pick one to believe,
                    and picking ours is the mistake this is here to expose. */}
                <span style={pill(t.status)}>{t.status}</span>
                {/* Whichever store this tester actually goes through. Showing
                    "not with Apple" against an Android-only tester was the
                    first version, and it read as a fault when it was just the
                    wrong question. */}
                {isAndroid(t) && (t.platform ?? "ios").toLowerCase() === "android" ? (
                  <span style={playPillStyle(play)}>{playLabel(play)}</span>
                ) : (
                  <span style={applePill(t.apple?.state)}>
                    {t.apple ? appleLabel(t.apple.state) : "not with Apple"}
                  </span>
                )}
                <button style={dangerBtn} disabled={busy === t.id} onClick={() => onAction(t.id, "remove")}>
                  Remove access
                </button>
              </div>
            </div>

            <NotesField applicant={t} busy={busy} onAction={onAction} />
          </div>
        );
      })}
    </div>
  );
}

/* ── feedback ── */

const FEEDBACK_STATUSES = ["new", "triaged", "in_progress", "fixed", "wont_fix", "duplicate"];

function FeedbackList({
  feedback,
  releases,
  busy,
  onPatch,
}: {
  feedback: Feedback[];
  releases: Release[];
  busy: string | null;
  onPatch: (id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = useMemo(
    () => (showAll ? feedback : feedback.filter((f) => f.status === "new" || f.status === "triaged" || f.status === "in_progress")),
    [feedback, showAll],
  );
  const drafts = releases.filter((r) => r.status === "draft");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button style={ghostBtn} onClick={() => setShowAll((v) => !v)}>
        {showAll ? "Show only open" : `Show all (${feedback.length})`}
      </button>

      {visible.length === 0 && (
        <div style={{ ...card, color: "var(--muted)", fontSize: 13 }}>Nothing open.</div>
      )}

      {visible.map((f) => (
        <div key={f.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {f.signup?.firstName ?? f.email} · {f.platform} {f.appVersion ?? ""}
              {f.buildNumber ? ` (build ${f.buildNumber})` : ""} · {f.screen ?? "unknown screen"} · {ago(f.createdAt)}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={pill(f.kind)}>{f.kind}</span>
              {f.rating !== null && <span style={pill("triaged")}>{f.rating}</span>}
              <span style={pill(f.status)}>{f.status}</span>
            </div>
          </div>

          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 8,
              backgroundColor: "var(--background)",
              fontSize: 13.5,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
            }}
          >
            {f.message}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={f.status}
              disabled={busy === f.id}
              onChange={(e) => onPatch(f.id, { status: e.target.value })}
              style={{ ...inputStyle, width: 150 }}
            >
              {FEEDBACK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            {/* Attaching a report to a draft build is what makes the build
                note tell this tester, by name, that their report shipped. */}
            <select
              value={f.releaseId ?? ""}
              disabled={busy === f.id || drafts.length === 0}
              onChange={(e) => onPatch(f.id, { releaseId: e.target.value || null })}
              style={{ ...inputStyle, width: 230 }}
            >
              <option value="">Not fixed in a build yet</option>
              {drafts.map((r) => (
                <option key={r.id} value={r.id}>
                  Fixed in build {r.buildNumber}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── releases ── */

function Releases({
  releases,
  onChanged,
  say,
  testerCount,
}: {
  releases: Release[];
  onChanged: () => Promise<void>;
  say: (msg: string) => void;
  testerCount: number;
}) {
  const [version, setVersion] = useState("");
  const [buildNumber, setBuildNumber] = useState("");
  const [headline, setHeadline] = useState("");
  const [whatsNew, setWhatsNew] = useState("");
  const [knownIssues, setKnownIssues] = useState("");
  const [askThem, setAskThem] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);

  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

  async function create() {
    setSaving(true);
    try {
      const res = await fetch("/api/studio/beta/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version,
          buildNumber,
          headline,
          whatsNew: lines(whatsNew),
          knownIssues: lines(knownIssues),
          askThem: askThem.trim() || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setVersion("");
      setBuildNumber("");
      setHeadline("");
      setWhatsNew("");
      setKnownIssues("");
      setAskThem("");
      say("Draft build note created.");
      await onChanged();
    } catch (err) {
      say(`Failed: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function publish(r: Release) {
    // The one irreversible action on this screen. Confirming names the real
    // number of people it will reach.
    if (
      !window.confirm(
        `Send the build ${r.buildNumber} note to ${testerCount} tester${testerCount === 1 ? "" : "s"} by email and push? This cannot be undone.`,
      )
    ) {
      return;
    }
    setPublishing(r.id);
    try {
      const res = await fetch("/api/studio/beta/releases", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      say(
        `Build ${r.buildNumber}: ${json.emailed} emailed, ${json.pushed} pushed${
          json.pushSkippedReason ? ` (push skipped: ${json.pushSkippedReason})` : ""
        }${json.emailFailed ? `, ${json.emailFailed} failed` : ""}.`,
      );
      await onChanged();
    } catch (err) {
      say(`Failed: ${String(err)}`);
    } finally {
      setPublishing(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={card}>
        <div style={{ ...labelStyle(), marginBottom: 10 }}>New build note</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <input style={inputStyle} placeholder="Version (1.2.0)" value={version} onChange={(e) => setVersion(e.target.value)} />
          <input style={inputStyle} placeholder="Build number (279)" value={buildNumber} onChange={(e) => setBuildNumber(e.target.value)} />
        </div>
        <input
          style={{ ...inputStyle, marginTop: 10 }}
          placeholder="Headline (Audio starts instantly now)"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
        />
        <div style={{ ...labelStyle(), marginTop: 12, marginBottom: 6 }}>What changed (one per line)</div>
        <textarea style={areaStyle} value={whatsNew} onChange={(e) => setWhatsNew(e.target.value)} />
        <div style={{ ...labelStyle(), marginTop: 12, marginBottom: 6 }}>Known issues (one per line, optional)</div>
        <textarea style={areaStyle} value={knownIssues} onChange={(e) => setKnownIssues(e.target.value)} />
        <div style={{ ...labelStyle(), marginTop: 12, marginBottom: 6 }}>If they only do one thing</div>
        <input style={inputStyle} value={askThem} onChange={(e) => setAskThem(e.target.value)} placeholder="Open a story and skip forward twice" />
        <button style={{ ...btn, marginTop: 12 }} disabled={saving} onClick={create}>
          {saving ? "Saving..." : "Create draft"}
        </button>
      </div>

      {releases.map((r) => (
        <div key={r.id} style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Build {r.buildNumber} <span style={{ color: "var(--muted)", fontWeight: 500 }}>v{r.version}</span>
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{r.headline}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={pill(r.status)}>{r.status}</span>
              {r.status === "draft" && (
                <button style={btn} disabled={publishing === r.id} onClick={() => publish(r)}>
                  {publishing === r.id ? "Sending..." : "Publish and notify"}
                </button>
              )}
            </div>
          </div>
          {r.status === "published" && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              Sent to {r.notifiedCount} testers {ago(r.publishedAt)}
            </div>
          )}
          <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            {r.whatsNew.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ── rules ── */

function RulesPanel({
  rules,
  health,
  onReload,
  say,
}: {
  rules: Rules;
  health: Payload["health"];
  onReload: (withHealth?: boolean) => Promise<void>;
  say: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<Rules>(rules);
  const [saving, setSaving] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => setDraft(rules), [rules]);

  async function createGroup() {
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/studio/beta", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      say(json.created ? `Created the "${json.name}" group.` : `"${json.name}" already existed.`);
      await onReload(true);
    } catch (err) {
      say(`Failed: ${String(err)}`);
    } finally {
      setCreatingGroup(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/studio/beta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      say("Rules saved.");
      await onReload();
    } catch (err) {
      say(`Failed: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  const num = (key: keyof Rules, label: string, hint: string) => (
    <div key={key}>
      <div style={labelStyle()}>{label}</div>
      <input
        style={{ ...inputStyle, marginTop: 4 }}
        type="number"
        value={String(draft[key] ?? 0)}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
      />
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{hint}</div>
    </div>
  );

  const dateField = (key: "betaEndsAt" | "launchedAt", label: string, hint: string) => (
    <div key={key}>
      <div style={labelStyle()}>{label}</div>
      <input
        style={{ ...inputStyle, marginTop: 4 }}
        type="date"
        value={draft[key] ? new Date(draft[key] as string).toISOString().slice(0, 10) : ""}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value || null })}
      />
      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{hint}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>App Store Connect</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {health === null
                ? "Not checked yet."
                : health.ok
                  ? `Connected. Groups: ${health.groups.map((g) => `${g.name}${g.internal ? " (internal)" : ""}`).join(", ") || "none"}`
                  : `Not working: ${health.error}`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button style={ghostBtn} onClick={() => onReload(true)}>
              Check connection
            </button>
            <button style={ghostBtn} disabled={creatingGroup} onClick={createGroup}>
              {creatingGroup ? "Working..." : "Create beta group"}
            </button>
          </div>
        </div>
      </div>

      <div style={card}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={draft.autoInviteEnabled}
            onChange={(e) => setDraft({ ...draft, autoInviteEnabled: e.target.checked })}
          />
          <span style={{ fontWeight: 700, fontSize: 14 }}>Auto-invite is on</span>
        </label>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
          Off means every application waits for you, however good it is.
        </div>
      </div>

      <div style={card}>
        <div style={{ ...labelStyle(), marginBottom: 12 }}>Thresholds</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          {num("autoAcceptAt", "Auto-accept at", "Score at or above this is invited with no review.")}
          {num("autoDeclineBelow", "Auto-decline below", "Score under this is declined with no review.")}
          {num("maxActiveTesters", "Tester cap", "Good applicants waitlist once this many are active.")}
        </div>
      </div>

      <div style={card}>
        <div style={{ ...labelStyle(), marginBottom: 12 }}>Schedule</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
          {num("installNudgeAfterDays", "Install nudge", "Days after the invite with no sign-in.")}
          {num("feedbackAskAfterDays", "Feedback ask", "Days after a tester starts.")}
          {num("midSurveyAfterDays", "Halfway survey", "Days after a tester starts.")}
          {num("finalSurveyBeforeEndDays", "Final survey", "Days before the beta ends.")}
          {dateField("betaEndsAt", "Beta ends", "Empty means the final survey never fires.")}
          {dateField("launchedAt", "Launched on", "Empty means the review ask never fires.")}
          {num("reviewAskMinRating", "Review ask at", "Final rating at or above this gets the review ask.")}
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={labelStyle()}>App Store review link</div>
          <input
            style={{ ...inputStyle, marginTop: 4 }}
            value={draft.appStoreReviewUrl ?? ""}
            placeholder="https://apps.apple.com/app/id.../?action=write-review"
            onChange={(e) => setDraft({ ...draft, appStoreReviewUrl: e.target.value || null })}
          />
        </div>
      </div>

      <div style={card}>
        <div style={labelStyle()}>Recruiting for (comma separated)</div>
        <input
          style={{ ...inputStyle, marginTop: 4 }}
          value={draft.acceptedTargetLanguages.join(", ")}
          onChange={(e) =>
            setDraft({ ...draft, acceptedTargetLanguages: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
          }
        />
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          Applications for anything else queue for review instead of being auto-invited.
        </div>
      </div>

      <button style={btn} disabled={saving} onClick={save}>
        {saving ? "Saving..." : "Save rules"}
      </button>
    </div>
  );
}
