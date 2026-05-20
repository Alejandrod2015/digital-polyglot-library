"use client";

import { useEffect, useMemo, useState } from "react";
import ValidarResultView from "./ValidarResultView";

type AgentRun = {
  id: string;
  agentKind: string;
  status: string;
  input: unknown;
  output: unknown;
  errorMessage: string | null;
  createdAt: string;
};

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

type Topic = { slug: string; label: string };
type Level = {
  id: string;
  title: string;
  subtitle: string;
  topics: Topic[];
};
type JourneyOption = {
  id: string;
  name: string;
  language: string;
  languageCode: string;
  variant: string;
  levels: Level[];
};

type OptionsResponse = { journeys: JourneyOption[] };

export default function ValidarPageClient() {
  const [options, setOptions] = useState<JourneyOption[] | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [journeyId, setJourneyId] = useState("");
  const [levelId, setLevelId] = useState("");
  const [topicSlug, setTopicSlug] = useState("");

  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Run history (same pattern as QAClient / PlannerClient).
  const [runHistory, setRunHistory] = useState<AgentRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  async function loadRunHistory() {
    try {
      const res = await fetch("/api/agents/runs?kind=validar&limit=20");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { runs: AgentRun[] };
      setRunHistory(data.runs);
      setHistoryError(null);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "No se pudo cargar el historial de ejecuciones."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadRunHistory();
  }, []);

  // Load options on mount
  useEffect(() => {
    let cancelled = false;
    fetch("/api/studio/validar/options", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as OptionsResponse;
      })
      .then((data) => {
        if (!cancelled) setOptions(data.journeys ?? []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setOptionsError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedJourney = useMemo(
    () => options?.find((j) => j.id === journeyId) ?? null,
    [options, journeyId]
  );
  const selectedLevel = useMemo(
    () => selectedJourney?.levels.find((l) => l.id === levelId) ?? null,
    [selectedJourney, levelId]
  );

  // Reset cascading when parent changes
  useEffect(() => {
    setLevelId("");
    setTopicSlug("");
  }, [journeyId]);
  useEffect(() => {
    setTopicSlug("");
  }, [levelId]);

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
          level: levelId || undefined,
          topic: topicSlug || undefined,
          language: selectedJourney?.languageCode || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ValidateResponse;
      setResult(json);
      setHistoryLoading(true);
      await loadRunHistory();
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

  const ctxReady = !!journeyId && !!levelId && !!topicSlug;

  return (
    <div className="space-y-6">
      {optionsError && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          No se pudo cargar la lista de journeys ({optionsError}). Puedes igual pegar el JSON y validar
          la estructura básica, pero los checks de vocabulario cruzado entre historias no se activan.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Journey</span>
          <select
            value={journeyId}
            onChange={(e) => setJourneyId(e.target.value)}
            disabled={!options}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-100 disabled:opacity-50"
          >
            <option value="">{options ? "Elige un journey…" : "Cargando…"}</option>
            {options?.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name} ({j.languageCode || j.language} · {j.variant})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Nivel</span>
          <select
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            disabled={!selectedJourney}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-100 disabled:opacity-50"
          >
            <option value="">
              {selectedJourney ? "Elige un nivel…" : "Primero elige journey"}
            </option>
            {selectedJourney?.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
                {l.subtitle ? ` — ${l.subtitle}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Tema</span>
          <select
            value={topicSlug}
            onChange={(e) => setTopicSlug(e.target.value)}
            disabled={!selectedLevel || selectedLevel.topics.length === 0}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-neutral-100 disabled:opacity-50"
          >
            <option value="">
              {!selectedLevel
                ? "Primero elige nivel"
                : selectedLevel.topics.length === 0
                  ? "Este nivel no tiene temas cargados"
                  : "Elige un tema…"}
            </option>
            {selectedLevel?.topics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {ctxReady && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200">
          Listo. Al validar se compararán palabras, títulos y nombres contra las historias que ya
          existan en este tema.
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm text-neutral-400">
          Pega aquí el texto que te dio el asistente (el JSON)
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
        <ValidarResultView
          ok={result.ok}
          checks={result.checks}
          summary={result.summary}
          parsed={result.parsed}
          existingCount={result.existingCount}
          rawInput={raw}
        />
      )}

      {/* ── Run history (collapsible) ── */}
      <div className="rounded-md border border-neutral-700 bg-neutral-900/40">
        <div
          onClick={() => setHistoryOpen(!historyOpen)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setHistoryOpen(!historyOpen);
            }
          }}
          role="button"
          tabIndex={0}
          className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm text-neutral-200 hover:bg-neutral-800/40"
        >
          <span>
            Historial de validaciones{" "}
            <span className="text-neutral-500">
              ({historyLoading ? "…" : runHistory.length})
            </span>
          </span>
          <span
            className="text-neutral-400"
            style={{
              fontSize: 12,
              transform: historyOpen ? "rotate(180deg)" : "none",
              transition: "transform 120ms",
            }}
          >
            ▾
          </span>
        </div>
        {historyOpen && (
          <div className="border-t border-neutral-800 px-3 py-3">
            {historyLoading ? (
              <p className="px-1 text-xs text-neutral-500">Cargando…</p>
            ) : historyError ? (
              <p className="px-1 text-xs text-rose-400">{historyError}</p>
            ) : runHistory.length === 0 ? (
              <p className="px-1 text-xs text-neutral-500">
                Aún no hay validaciones guardadas. Cada validación queda registrada
                aquí.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {runHistory.map((run) => {
                  const isExpanded = expandedRun === run.id;
                  const input = (run.input ?? {}) as {
                    topic?: string | null;
                    level?: string | null;
                    language?: string | null;
                    existingCount?: number;
                    raw?: string;
                    payload?: { title?: unknown } | null;
                  };
                  const output = (run.output ?? null) as {
                    ok?: boolean;
                    summary?: { pass: number; warn: number; fail: number };
                    checks?: Check[];
                    parsed?: { title?: string; arcType?: string } | null;
                  } | null;
                  const created = new Date(run.createdAt).toLocaleString();
                  // Resuelve un título legible incluso si el JSON falló parseo.
                  const payloadTitle =
                    input.payload && typeof input.payload.title === "string"
                      ? (input.payload.title as string)
                      : null;
                  const rawTitleMatch =
                    typeof input.raw === "string"
                      ? input.raw.match(/"title"\s*:\s*"([^"]+)"/)
                      : null;
                  const rawTitle = rawTitleMatch ? rawTitleMatch[1] : null;
                  const displayTitle =
                    output?.parsed?.title ?? payloadTitle ?? rawTitle ?? null;
                  const titleIsFallback = !output?.parsed?.title && !!displayTitle;
                  // Friendly status label + colour.
                  const statusInfo =
                    run.status === "failed" || run.errorMessage
                      ? { label: "Falló", color: "bg-rose-500/20 text-rose-300" }
                      : output?.ok
                        ? { label: "Lista para subir", color: "bg-emerald-500/20 text-emerald-300" }
                        : { label: "No lista", color: "bg-amber-500/20 text-amber-300" };
                  return (
                    <li
                      key={run.id}
                      className="rounded-md border border-neutral-800 bg-neutral-950/40"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-xs hover:bg-neutral-900/40"
                      >
                        <span className="flex flex-1 flex-col gap-1 min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                            {displayTitle ? (
                              <span
                                className={`truncate font-medium ${titleIsFallback ? "text-amber-200" : "text-neutral-200"}`}
                                title={
                                  titleIsFallback
                                    ? "Título extraído del texto crudo (JSON con errores)"
                                    : undefined
                                }
                              >
                                {displayTitle}
                              </span>
                            ) : (
                              <span className="text-neutral-500 italic">Sin título</span>
                            )}
                            {output?.parsed?.arcType && (
                              <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-300">
                                {output.parsed.arcType}
                              </span>
                            )}
                          </span>
                          <span className="flex flex-wrap items-center gap-2 text-neutral-400">
                            {output?.summary && (
                              <span>
                                {output.summary.fail > 0
                                  ? `${output.summary.fail} ${output.summary.fail === 1 ? "problema" : "problemas"}`
                                  : output.summary.warn > 0
                                    ? `${output.summary.warn} aviso${output.summary.warn === 1 ? "" : "s"}`
                                    : "todo OK"}
                              </span>
                            )}
                            {input.topic && (
                              <span className="truncate text-neutral-500">
                                · {input.level?.toUpperCase()} / {input.topic}
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 text-neutral-500 text-[11px]">{created}</span>
                      </button>
                      {isExpanded && (
                        <div className="border-t border-neutral-800 px-3 py-3">
                          {output?.checks && output.checks.length > 0 ? (
                            <ValidarResultView
                              ok={output?.ok ?? false}
                              checks={output.checks}
                              summary={
                                output?.summary ?? { pass: 0, warn: 0, fail: 0 }
                              }
                              parsed={output?.parsed ?? null}
                              status={run.status}
                              meta={{
                                topic: input.topic ?? null,
                                level: input.level ?? null,
                                createdAt: run.createdAt,
                              }}
                              errorMessage={run.errorMessage}
                              rawInput={input.raw ?? null}
                            />
                          ) : (
                            <>
                              {run.errorMessage && (
                                <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                                  <span className="font-semibold">Error técnico:</span> {run.errorMessage}
                                </div>
                              )}
                              <p className="mt-2 text-[11px] text-neutral-500 italic">
                                No hay detalle de checks para esta corrida.
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
