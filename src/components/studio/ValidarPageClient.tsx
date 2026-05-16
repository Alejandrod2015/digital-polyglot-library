"use client";

import { useState } from "react";

type CheckStatus = "pass" | "fail" | "warn";

type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  detail?: string;
};

type ValidateResponse = {
  ok: boolean;
  checks: Check[];
  summary: { pass: number; warn: number; fail: number };
  existingCount?: number;
  parsed?: {
    title?: string;
    arcType?: string;
  } | null;
};

const LANGUAGE_OPTIONS = [
  { code: "", label: "(no especificar)" },
  { code: "ES", label: "Español" },
  { code: "DE", label: "Alemán" },
  { code: "IT", label: "Italiano" },
  { code: "PT", label: "Portugués" },
  { code: "FR", label: "Francés" },
  { code: "EN", label: "Inglés" },
];

const LEVEL_OPTIONS = ["", "A1", "A2", "B1", "B2", "C1", "C2"];

const STATUS_COLOR: Record<CheckStatus, string> = {
  pass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  warn: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  fail: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

const STATUS_BADGE: Record<CheckStatus, string> = {
  pass: "OK",
  warn: "⚠",
  fail: "✗",
};

export default function ValidarPageClient() {
  const [raw, setRaw] = useState("");
  const [journeyId, setJourneyId] = useState("");
  const [level, setLevel] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("");
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/studio/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw,
          journeyId: journeyId || undefined,
          level: level || undefined,
          topic: topic || undefined,
          language: language || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ValidateResponse;
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setRaw("");
    setResult(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Idioma</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-100"
          >
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Nivel CEFR</span>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-100"
          >
            {LEVEL_OPTIONS.map((l) => (
              <option key={l} value={l}>
                {l || "(no especificar)"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Topic slug</span>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="food-daily-life"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Journey ID</span>
          <input
            type="text"
            value={journeyId}
            onChange={(e) => setJourneyId(e.target.value)}
            placeholder="opcional, activa checks cross-historia"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-100"
          />
        </label>
      </div>

      <div>
        <label className="mb-1 block text-sm text-neutral-400">
          Pega aquí el JSON que devolvió el Custom GPT
        </label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={14}
          placeholder='{"title":"...","synopsis":"...","arcType":"...","text":"...","vocab":[...]}'
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-xs text-neutral-100"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading || !raw.trim()}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Validando…" : "Validar"}
        </button>
        <button
          onClick={handleClear}
          disabled={loading || !raw}
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
        >
          Limpiar
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 rounded-md border border-neutral-700 bg-neutral-900/40 px-4 py-3 text-sm">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                result.ok
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-rose-500/20 text-rose-300"
              }`}
            >
              {result.ok ? "LISTA PARA SUBIR" : "NO LISTA"}
            </span>
            <span className="text-neutral-300">
              {result.summary.pass} OK · {result.summary.warn} avisos ·{" "}
              {result.summary.fail} fallos
            </span>
            {result.parsed?.title && (
              <span className="text-neutral-400">
                <span className="text-neutral-500">Historia:</span>{" "}
                {result.parsed.title}{" "}
                {result.parsed.arcType && (
                  <span className="ml-1 rounded bg-neutral-800 px-1.5 py-0.5 text-xs">
                    {result.parsed.arcType}
                  </span>
                )}
              </span>
            )}
            {typeof result.existingCount === "number" && result.existingCount > 0 && (
              <span className="text-neutral-500">
                Comparado contra {result.existingCount} historia(s) en el tema
              </span>
            )}
          </div>

          <ul className="space-y-1.5">
            {result.checks.map((c) => (
              <li
                key={c.id}
                className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${STATUS_COLOR[c.status]}`}
              >
                <span className="font-mono text-xs font-semibold leading-5">
                  {STATUS_BADGE[c.status]}
                </span>
                <div className="flex-1">
                  <div className="font-medium">{c.label}</div>
                  {c.detail && (
                    <div className="mt-0.5 text-xs opacity-80">{c.detail}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
