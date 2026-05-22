"use client";

import { useEffect, useMemo, useState } from "react";
import ValidarResultView from "./ValidarResultView";
import ValidationHistory from "./ValidationHistory";
import { getIsoLanguageTag } from "@/lib/languageFlags";
import { parseStoryInput, type StoryPayload } from "@/lib/validateGeneratedStory";

type PipelineStory = {
  id: string;
  title: string | null;
  slug: string | null;
  level: string;
  topic: string;
  slotIndex: number;
  status: string;
  coverDone: boolean;
  coverUrl: string | null;
  audioUrl: string | null;
  audioStatus: string;
  arcType: string | null;
  journeyId: string;
  journey: {
    id: string;
    name: string;
    language: string;
    variant: string;
  };
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
  // Staging UI: confirm sheet + post-success state.
  const [staging, setStaging] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [stageConfirmOpen, setStageConfirmOpen] = useState(false);
  const [stagedStory, setStagedStory] = useState<{
    id: string;
    slug: string;
    slotIndex: number;
    title: string;
  } | null>(null);

  // Pipeline grid: real journey stories grouped by journey/level/topic.
  // (Reemplaza el "historial de validaciones" colapsable anterior — los
  // AgentRun del validador siguen guardándose en DB para audit pero ya
  // no se renderizan en esta pantalla.)
  const [pipelineStories, setPipelineStories] = useState<PipelineStory[]>([]);
  const [pipelineLoading, setPipelineLoading] = useState(true);

  async function loadPipelineStories() {
    try {
      const res = await fetch("/api/studio/validar/stories", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { stories: PipelineStory[] };
      setPipelineStories(data.stories);
    } catch (err) {
      console.error("[validar] pipeline stories load failed", err);
    } finally {
      setPipelineLoading(false);
    }
  }

  useEffect(() => {
    void loadPipelineStories();
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
    setStageError(null);
    setStagedStory(null);
  }

  /**
   * "Subir al Studio" handler. Re-validates the payload server-side
   * against the live state of the chosen journey+level+topic and
   * creates a JourneyStory row with status="qa_pass" (invisible to
   * end users until cover/audio/publish run downstream).
   */
  async function handleStage() {
    if (!result || !result.ok) return;
    if (!journeyId || !levelId || !topicSlug) return;
    setStaging(true);
    setStageError(null);
    try {
      const res = await fetch("/api/studio/validar/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw: raw || undefined,
          journeyId,
          level: levelId,
          topic: topicSlug,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        story?: { id: string; slug: string; slotIndex: number; title: string };
        reason?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.story) {
        throw new Error(data.reason ?? data.error ?? `HTTP ${res.status}`);
      }
      setStagedStory(data.story);
      setStageConfirmOpen(false);
      // Refresh the pipeline grid so the new story aparece sin recargar.
      setPipelineLoading(true);
      await loadPipelineStories();
    } catch (e) {
      setStageError(e instanceof Error ? e.message : String(e));
    } finally {
      setStaging(false);
    }
  }

  const ctxReady = !!journeyId && !!levelId && !!topicSlug;
  const canStage = !!result?.ok && ctxReady && !stagedStory;

  // Contador para forzar refresh del feed "Mis validaciones" después de
  // una subida directa desde el historial. Sin esto, el badge "✓ En
  // Studio" no aparecería hasta que la usuaria clickee Refrescar.
  const [historyRefreshTick, setHistoryRefreshTick] = useState(0);

  /**
   * "Subir al Studio" desde una fila del feed de validaciones.
   * Si ya hay context (journey/level/topic) en la página → POST
   * directo a /stage con el raw guardado en esa AgentRun.
   * Si NO hay context → cargamos el raw en el form, scrolleamos
   * arriba, y mostramos al editor que debe elegir el destino.
   */
  async function stageFromHistory(historyRaw: string, _title: string) {
    if (!ctxReady) {
      setRaw(historyRaw);
      setResult(null);
      setError(null);
      setStageError(null);
      setStagedStory(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setRaw(historyRaw);
    setStaging(true);
    setStageError(null);
    try {
      const res = await fetch("/api/studio/validar/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw: historyRaw,
          journeyId,
          level: levelId,
          topic: topicSlug,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        story?: { id: string; slug: string; slotIndex: number; title: string };
        reason?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.story) {
        throw new Error(data.reason ?? data.error ?? `HTTP ${res.status}`);
      }
      setStagedStory(data.story);
      setPipelineLoading(true);
      await loadPipelineStories();
      // Bump tick to force ValidationHistory a refrescar — la fila
      // que acabamos de subir cambia su badge a "✓ En Studio" sin
      // que la usuaria tenga que clickear Refrescar.
      setHistoryRefreshTick((n) => n + 1);
    } catch (e) {
      setStageError(e instanceof Error ? e.message : String(e));
    } finally {
      setStaging(false);
    }
  }

  // Live preview of the pasted JSON. Uses the same parser as the server
  // so what the worker sees here matches what gets validated. Returns
  // null silently if the JSON doesn't parse yet — the textarea state
  // pill below already signals "vacío"/"pegado"/"validado" so workers
  // know whether the input is parseable.
  const parsedPreview: StoryPayload | null = useMemo(() => {
    if (!raw.trim()) return null;
    return parseStoryInput(raw);
  }, [raw]);

  // Step indicator: 1 = pick journey/level/topic, 2 = paste+validate, 3 = stage.
  const currentStep: 1 | 2 | 3 = !ctxReady ? 1 : !result?.ok ? 2 : 3;

  // JSON state badge ("vacío" / "pegado" / "validado")
  const jsonStateLabel = !raw.trim()
    ? "vacío"
    : result
      ? result.ok
        ? "validado"
        : "con errores"
      : "pegado";
  const jsonStateClass = !raw.trim()
    ? "text-neutral-500"
    : result?.ok
      ? "text-emerald-400"
      : result
        ? "text-amber-300"
        : "text-sky-300";

  // Helper: load example JSON into the textarea.
  function loadExampleJson() {
    setRaw(
      JSON.stringify(
        {
          title: "Café in Kreuzberg",
          synopsis:
            "Eine kurze Begegnung an einem Samstagvormittag in einem Café in Kreuzberg, wo zwei Fremde über das Wetter sprechen und ein leiser Moment entsteht.",
          arcType: "daily-encounter",
          text:
            "Es ist Samstagvormittag in Kreuzberg. Die Sonne scheint, das Café riecht nach frischem Kaffee.\n\nAnna: Guten Morgen. Ist hier frei?\nThomas: Ja, klar. Setzen Sie sich.",
          vocab: [
            { word: "Vormittag", definition: "Morning before noon.", type: "noun" },
          ],
        },
        null,
        2
      )
    );
  }

  // Number of existing stories in the current target slot (only valid
  // after a validate run that included the journey context).
  const targetExistingCount = result?.existingCount ?? null;

  return (
    <div className="space-y-6">
      {/* ── 3-STEP HEADER ── */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 px-5 py-4">
        <div className="flex flex-wrap items-stretch gap-x-8 gap-y-3">
          <StepCard
            n={1}
            label="Combo"
            sub="Elige journey · nivel · tema"
            state={currentStep === 1 ? "current" : "done"}
          />
          <StepDivider />
          <StepCard
            n={2}
            label="JSON"
            sub="Pega el JSON y valida"
            state={currentStep === 2 ? "current" : currentStep > 2 ? "done" : "todo"}
          />
          <StepDivider />
          <StepCard
            n={3}
            label="Subir"
            sub="Un clic al Studio"
            state={currentStep === 3 ? "current" : "todo"}
          />
          <div className="ml-auto flex items-center gap-2 self-center">
            <button
              type="button"
              onClick={handleClear}
              className="text-[12px] font-medium text-neutral-400 hover:text-neutral-200"
            >
              Reiniciar
            </button>
            <kbd className="rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
              Esc
            </kbd>
          </div>
        </div>
      </div>

      {optionsError && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          No se pudo cargar la lista de journeys ({optionsError}). Puedes igual pegar el JSON y validar
          la estructura básica, pero los checks de vocabulario cruzado entre historias no se activan.
        </div>
      )}

      {/* ── TWO-COLUMN: FORM (left) + DESTINO (right) ── */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* LEFT COLUMN ─────────────────────────────────────── */}
        <div className="space-y-3">
          {/* 3 dropdowns en pills */}
          <div className="grid gap-2 sm:grid-cols-3">
            <SelectPill
              label="Journey"
              value={journeyId}
              onChange={(v) => setJourneyId(v)}
              disabled={!options}
              placeholder={options ? "Elige un journey…" : "Cargando…"}
              options={(options ?? []).map((j) => ({
                value: j.id,
                label: `${j.name} (${j.languageCode || j.language} · ${j.variant})`,
              }))}
            />
            <SelectPill
              label="Nivel"
              value={levelId}
              onChange={(v) => setLevelId(v)}
              disabled={!selectedJourney}
              placeholder={selectedJourney ? "Elige un nivel…" : "Primero elige journey"}
              options={(selectedJourney?.levels ?? []).map((l) => ({
                value: l.id,
                label: l.title + (l.subtitle ? ` — ${l.subtitle}` : ""),
              }))}
            />
            <SelectPill
              label="Tema"
              value={topicSlug}
              onChange={(v) => setTopicSlug(v)}
              disabled={!selectedLevel || (selectedLevel?.topics.length ?? 0) === 0}
              placeholder={
                !selectedLevel
                  ? "Primero elige nivel"
                  : selectedLevel.topics.length === 0
                    ? "Sin temas cargados"
                    : "Elige un tema…"
              }
              options={(selectedLevel?.topics ?? []).map((t) => ({
                value: t.slug,
                label: t.label,
              }))}
            />
          </div>

          {/* JSON card */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40">
            <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                <span aria-hidden>📋</span> Pega el JSON
              </div>
              <span className={`text-[11px] font-medium ${jsonStateClass}`}>{jsonStateLabel}</span>
            </div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={8}
              placeholder={`{\n  "title": "…",\n  "synopsis": "…",\n  "level": "a2",\n  "topic": "shopping-money",\n  "body": "…",\n  "vocab": [ … ]\n}`}
              className="w-full bg-transparent px-3 py-3 font-mono text-[12px] leading-5 text-neutral-100 outline-none resize-y"
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-neutral-800 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500">
                <span
                  aria-hidden
                  className={`inline-block h-2 w-2 rounded-full ${
                    !raw.trim()
                      ? "bg-neutral-600"
                      : result?.ok
                        ? "bg-emerald-400"
                        : result
                          ? "bg-amber-400"
                          : "bg-sky-400"
                  }`}
                />
                {!raw.trim()
                  ? "Pega un JSON y dale a Validar"
                  : result?.ok
                    ? "Validación pasada"
                    : result
                      ? `${result.summary.fail} ${result.summary.fail === 1 ? "problema" : "problemas"}`
                      : "JSON pegado, pendiente de validar"}
              </span>
              <button
                type="button"
                onClick={loadExampleJson}
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-200"
              >
                ✻ Cargar JSON de ejemplo
              </button>
              <button
                onClick={handleClear}
                disabled={loading || !raw}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-[12px] text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
              >
                Limpiar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !raw.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-gold)] px-3.5 py-1.5 text-[12px] font-extrabold text-[#2a1a02] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? "Validando…" : "Validar"}
                <kbd className="rounded bg-black/20 px-1 py-0.5 font-mono text-[9px] text-[#2a1a02]/85">
                  ↵
                </kbd>
              </button>
            </div>
          </div>

          {/* Live preview of the parsed JSON — helps workers spot tone /
              coherence problems that the structural validator can't catch.
              Renders silently when the JSON parses; stays hidden otherwise
              so the textarea state pill above is the source of truth for
              parse status. */}
          {parsedPreview && <StoryPreview story={parsedPreview} />}
        </div>

        {/* RIGHT COLUMN: DESTINO ───────────────────────────── */}
        <DestinoCard
          journey={selectedJourney}
          level={selectedLevel}
          topicSlug={topicSlug}
          existingCount={targetExistingCount}
          parsedTitle={result?.parsed?.title ?? null}
          canStage={canStage}
          onStage={() => {
            setStageError(null);
            setStageConfirmOpen(true);
          }}
        />
      </div>

      {stagedStory && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <div className="font-semibold">Historia subida al Studio</div>
          <div className="mt-1 text-xs text-emerald-200/85">
            <span className="font-bold">{stagedStory.title}</span> quedó en{" "}
            {selectedJourney?.name} / {selectedLevel?.title} / {topicSlug}, posición #{stagedStory.slotIndex}.
            Aún no es visible para usuarios: faltan portada, audio y publish.
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={`/studio/journey-stories/${stagedStory.id}`}
              className="inline-flex rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
            >
              Abrir en Studio
            </a>
            <button
              onClick={handleClear}
              className="inline-flex rounded-md border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/10"
            >
              Validar otra historia
            </button>
          </div>
        </div>
      )}

      {stageConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => (!staging ? setStageConfirmOpen(false) : null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Confirmar subida al Studio</h3>
            <p className="mt-1 text-xs text-neutral-400">
              Esta acción crea una historia en el journey con status{" "}
              <span className="font-mono text-neutral-200">qa_pass</span>. No es visible para
              usuarios todavía: faltan los pasos manuales de portada, audio y publish.
            </p>

            <div className="mt-4 rounded-md border border-neutral-800 bg-neutral-950/60 p-3 text-sm space-y-1">
              <div className="flex justify-between gap-3">
                <span className="text-neutral-500">Journey</span>
                <span className="font-medium text-neutral-200">
                  {selectedJourney?.name}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-neutral-500">Nivel</span>
                <span className="font-medium text-neutral-200">{selectedLevel?.title}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-neutral-500">Tema</span>
                <span className="font-medium text-neutral-200">{topicSlug}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-neutral-500">Título</span>
                <span className="font-medium text-neutral-200 truncate text-right max-w-[60%]">
                  {result?.parsed?.title ?? "—"}
                </span>
              </div>
              {typeof result?.existingCount === "number" ? (
                <div className="flex justify-between gap-3">
                  <span className="text-neutral-500">Historias ya en el tema</span>
                  <span className="font-medium text-neutral-200">{result.existingCount}</span>
                </div>
              ) : null}
            </div>

            <p className="mt-3 text-[11px] text-neutral-500">
              Antes de crear la historia se re-valida contra las historias existentes del tema
              para atrapar colisiones de vocab y nombres de personajes.
            </p>

            {stageError && (
              <div className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {stageError}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setStageConfirmOpen(false)}
                disabled={staging}
                className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleStage()}
                disabled={staging}
                className="rounded-md bg-[var(--color-gold)] px-3 py-1.5 text-sm font-extrabold text-[#2a1a02] hover:brightness-105 disabled:opacity-40"
              >
                {staging ? "Subiendo…" : "Sí, subir"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* ── MIS VALIDACIONES: feed propio de la trabajadora ──
          Cada fila se expande al click mostrando synopsis, texto y
          vocab. Botón "↑ Subir al Studio" delega aquí:
          - Con context → POST /stage directo (un solo clic).
          - Sin context → carga el JSON al form y scrollea arriba. */}
      <ValidationHistory
        onStageDirect={stageFromHistory}
        contextReady={ctxReady}
        refreshSignal={historyRefreshTick}
      />

      {/* ── INVENTARIO con dots por nivel ── */}
      <InventoryDots stories={pipelineStories} loading={pipelineLoading} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ─── Step header components ───────────────────────────────────────
type StepState = "current" | "done" | "todo";
function StepCard({
  n,
  label,
  sub,
  state,
}: {
  n: number;
  label: string;
  sub: string;
  state: StepState;
}) {
  const circle =
    state === "current"
      ? "bg-emerald-500 text-[#062148]"
      : state === "done"
        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
        : "bg-neutral-800 text-neutral-400 border border-neutral-700";
  const labelCls = state === "todo" ? "text-neutral-500" : "text-neutral-200";
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span
        className={`inline-grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-black ${circle}`}
      >
        {n}
      </span>
      <div className="min-w-0">
        <div className={`text-[10px] font-extrabold uppercase tracking-[0.22em] ${labelCls}`}>
          {label}
        </div>
        <div className="text-[12px] text-neutral-400 truncate">{sub}</div>
      </div>
    </div>
  );
}
function StepDivider() {
  return <span className="hidden sm:block self-center text-neutral-700">─</span>;
}

// ─── Compact select pill ──────────────────────────────────────────
function SelectPill({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label
      className={`block rounded-xl border px-3 py-2 transition-colors ${
        value
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-neutral-800 bg-neutral-900/40"
      } ${disabled ? "opacity-60" : "hover:bg-neutral-800/40"}`}
    >
      <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-0.5 w-full bg-transparent text-[13px] font-bold text-neutral-100 outline-none disabled:cursor-not-allowed"
        style={{ appearance: "none" }}
      >
        <option value="" className="bg-[#0b1e36]">
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0b1e36]">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─── "Destino" panel (right column) ───────────────────────────────
function DestinoCard({
  journey,
  level,
  topicSlug,
  existingCount,
  parsedTitle,
  canStage,
  onStage,
}: {
  journey: JourneyOption | null;
  level: Level | null;
  topicSlug: string;
  existingCount: number | null;
  parsedTitle: string | null;
  canStage: boolean;
  onStage: () => void;
}) {
  const topicLabel = level?.topics.find((t) => t.slug === topicSlug)?.label ?? topicSlug;
  const isReady = !!(journey && level && topicSlug);
  return (
    <aside className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-5 flex flex-col">
      <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-neutral-400">
        <span aria-hidden>ⓘ</span> Destino
      </div>

      {!isReady ? (
        <div className="flex-1 grid place-items-center text-center py-6">
          <div>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-neutral-800/80 text-neutral-500">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
            </div>
            <p className="text-[12px] text-neutral-400 max-w-[22ch] mx-auto leading-relaxed">
              Elige journey, nivel y tema. Aquí verás el slot exacto donde aterriza la historia.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-sm space-y-1.5">
            <Row label="Journey" value={journey?.name ?? "—"} />
            <Row label="Nivel" value={level?.title ?? "—"} />
            <Row label="Tema" value={topicLabel} />
            {parsedTitle ? <Row label="Título" value={parsedTitle} /> : null}
            {existingCount != null ? (
              <Row
                label="Slot"
                value={
                  <span>
                    <span className="text-emerald-300 font-bold">#{existingCount + 1}</span>
                    <span className="text-neutral-500"> · habrá {existingCount + 1} historias</span>
                  </span>
                }
              />
            ) : null}
          </div>

          {canStage ? (
            <button
              type="button"
              onClick={onStage}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-gold)] px-4 py-2.5 text-[13px] font-extrabold text-[#2a1a02] hover:brightness-105"
            >
              ↑ Subir al Studio
            </button>
          ) : (
            <p className="text-[11px] text-neutral-500 text-center">
              Valida el JSON para habilitar la subida.
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-neutral-500 text-[12px]">{label}</span>
      <span className="font-medium text-neutral-200 text-[12px] text-right max-w-[60%] truncate">
        {value}
      </span>
    </div>
  );
}

// ─── Inventory with dot visualization ─────────────────────────────
function InventoryDots({
  stories,
  loading,
}: {
  stories: PipelineStory[];
  loading: boolean;
}) {
  // Group: journeyId → level → stories[]
  type LevelGroup = { level: string; stories: PipelineStory[] };
  type JourneyGroup = {
    id: string;
    name: string;
    language: string;
    variant: string;
    levels: Map<string, LevelGroup>;
    levelOrder: string[];
  };
  const groups = (() => {
    const map = new Map<string, JourneyGroup>();
    for (const s of stories) {
      let j = map.get(s.journeyId);
      if (!j) {
        j = {
          id: s.journeyId,
          name: s.journey.name,
          language: s.journey.language,
          variant: s.journey.variant,
          levels: new Map(),
          levelOrder: [],
        };
        map.set(s.journeyId, j);
      }
      let lvl = j.levels.get(s.level);
      if (!lvl) {
        lvl = { level: s.level, stories: [] };
        j.levels.set(s.level, lvl);
        j.levelOrder.push(s.level);
      }
      lvl.stories.push(s);
    }
    return [...map.values()];
  })();

  // Aggregate stats across all stories
  const total = stories.length;
  const published = stories.filter((s) => s.status === "published").length;
  const generated = stories.filter(
    (s) => s.status === "generated" || s.status === "qa_pass" || s.status === "approved"
  ).length;
  // "vacíos" = curriculum slots not filled. Sin curriculum target visible
  // aquí dejamos 0; el contador real de slots vacíos requeriría cruzar con
  // JOURNEY_CURRICULUM. Lo dejamos como 0 por ahora.
  const empty = Math.max(0, total - published - generated);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-neutral-300">
            Inventario · Historias ya subidas
          </h2>
          <span className="text-[12px] text-neutral-400">
            <span className="font-bold text-emerald-400">{published}</span>
            <span className="text-neutral-500">/{total}</span> publicadas
            {generated > 0 ? (
              <>
                <span className="mx-2 text-neutral-700">·</span>
                <span className="font-bold text-sky-400">{generated}</span> generadas
              </>
            ) : null}
            {empty > 0 ? (
              <>
                <span className="mx-2 text-neutral-700">·</span>
                <span className="font-bold text-neutral-400">{empty}</span> vacíos
              </>
            ) : null}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-neutral-500">
          <Legend dotClass="bg-emerald-400" label="publicada" />
          <Legend dotClass="bg-sky-400" label="generada" />
          <Legend dotClass="bg-transparent border border-neutral-600" label="vacío" />
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-4 text-[12px] text-neutral-500">
          Cargando…
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-6 text-center text-[12px] text-neutral-500">
          Aún no hay historias en el pipeline.
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map((j) => (
            <li
              key={j.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3"
            >
              <div className="flex items-center gap-4">
                <div className="min-w-[180px]">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-200">
                      {getIsoLanguageTag(j.language ?? "")}
                    </span>
                    <span className="text-[14px] font-extrabold text-neutral-100">
                      {capitalize(j.language)} · {capitalize(j.variant)}
                    </span>
                  </div>
                  <div className="mt-0.5 ml-1 font-mono text-[10px] uppercase tracking-wide text-neutral-500">
                    {j.variant} · {j.levelOrder.sort().join(" ")}
                  </div>
                </div>

                <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2">
                  {j.levelOrder.sort().map((lvl) => {
                    const list = j.levels.get(lvl)?.stories ?? [];
                    return (
                      <div key={lvl} className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-neutral-400 mr-1">
                          {lvl}
                        </span>
                        {list.map((s) => (
                          <span
                            key={s.id}
                            title={`${s.title ?? "(sin título)"} — ${s.status}`}
                            aria-hidden
                            className={`inline-block h-2 w-2 rounded-full ${
                              s.status === "published"
                                ? "bg-emerald-400"
                                : s.status === "generated" ||
                                    s.status === "qa_pass" ||
                                    s.status === "approved"
                                  ? "bg-sky-400"
                                  : "bg-transparent border border-neutral-600"
                            }`}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>

                <div className="text-right text-[12px]">
                  <span className="font-bold text-emerald-300">
                    {j.levels && Array.from(j.levels.values()).reduce((acc, l) => acc + l.stories.filter((s) => s.status === "published").length, 0)}
                  </span>
                  <span className="text-neutral-500">
                    /{Array.from(j.levels.values()).reduce((acc, l) => acc + l.stories.length, 0)} publ.
                  </span>
                  <span className="ml-2 text-neutral-500">›</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
function Legend({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}
function capitalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ──────────────────────────────────────────────────────────────────────
 * StoryPreview
 *
 * Renders the parsed StoryPayload in a readable layout so the worker
 * can scan the actual content (title, synopsis, body with speaker turns,
 * vocab chips) without parsing raw JSON in their head. This is where
 * humans catch the things the structural validator can't: tone,
 * pacing, coherence, naturalness of the dialogue.
 *
 * Body rendering: split on blank lines → paragraphs. For each ¶, detect
 * leading "Speaker: " label and render it as a bold inline tag colored
 * per speaker name (stable hash, distinct from narrator).
 * ────────────────────────────────────────────────────────────────────── */

const PREVIEW_SPEAKER_COLORS = [
  "#60a5fa", // blue
  "#f472b6", // pink
  "#34d399", // emerald
  "#a78bfa", // violet
  "#fb923c", // orange
  "#22d3ee", // cyan
];

function colorForSpeakerIndex(index: number): string {
  return PREVIEW_SPEAKER_COLORS[index % PREVIEW_SPEAKER_COLORS.length];
}

function StoryPreview({ story }: { story: StoryPayload }) {
  const paragraphs = useMemo(
    () =>
      story.text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
    [story.text],
  );

  // Stable color assignment in order of first appearance per story.
  const speakerColorMap = useMemo(() => {
    const re = /^([\p{Lu}][\p{L}\p{M}.'\-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'\-]*){0,3}):\s+/u;
    const map = new Map<string, number>();
    let cursor = 0;
    for (const p of paragraphs) {
      const m = p.match(re);
      if (m && !map.has(m[1])) {
        map.set(m[1], cursor++);
      }
    }
    return map;
  }, [paragraphs]);

  const bodyWords = useMemo(
    () => story.text.trim().split(/\s+/).filter(Boolean).length,
    [story.text],
  );
  const synopsisWords = useMemo(
    () => story.synopsis.trim().split(/\s+/).filter(Boolean).length,
    [story.synopsis],
  );

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/40">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
          Preview de la historia
        </div>
        <div className="flex items-center gap-2 text-[10px] text-neutral-500">
          <span className="rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 font-mono">
            {story.arcType || "sin arcType"}
          </span>
          <span>{bodyWords}w cuerpo · {synopsisWords}w sinopsis · {story.vocab.length} vocab</span>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* Title */}
        <h3 className="text-lg font-bold text-neutral-50 leading-tight">{story.title || "(sin título)"}</h3>

        {/* Synopsis */}
        {story.synopsis && (
          <p className="border-l-2 border-neutral-700 pl-3 text-[13px] italic leading-relaxed text-neutral-300">
            {story.synopsis}
          </p>
        )}

        {/* Body */}
        <div className="space-y-3 text-[14px] leading-relaxed text-neutral-100">
          {paragraphs.map((p, i) => {
            const m = p.match(/^([\p{Lu}][\p{L}\p{M}.'\-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'\-]*){0,3}):\s+([\s\S]*)$/u);
            if (m) {
              const speaker = m[1];
              const line = m[2];
              const colorIdx = speakerColorMap.get(speaker) ?? 0;
              const color = colorForSpeakerIndex(colorIdx);
              return (
                <div key={i} className="flex gap-2">
                  <span
                    className="shrink-0 font-bold"
                    style={{ color, minWidth: 64 }}
                  >
                    {speaker}:
                  </span>
                  <span className="text-neutral-200">{line}</span>
                </div>
              );
            }
            return (
              <p key={i} className="text-neutral-200">
                {p}
              </p>
            );
          })}
        </div>

        {/* Vocab chips */}
        {story.vocab.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
              Vocab ({story.vocab.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {story.vocab.map((v, i) => {
                const hasBadOpener = /^\s*(refers to|describes|used to|used for|said when)\b/i.test(
                  v.definition || "",
                );
                const inBody = story.text
                  .toLowerCase()
                  .includes((v.surface ?? v.word).toLowerCase());
                const issue = !inBody ? "no aparece en body" : hasBadOpener ? "opener prohibido" : null;
                return (
                  <span
                    key={`${v.word}-${i}`}
                    title={`${v.word}${v.surface ? ` (surface: ${v.surface})` : ""}${v.type ? ` · ${v.type}` : ""}\n${v.definition || ""}${issue ? `\n⚠ ${issue}` : ""}`}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                      issue
                        ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                        : "border-neutral-700 bg-neutral-900 text-neutral-200"
                    }`}
                  >
                    <span className="font-semibold">{v.word}</span>
                    {v.type && (
                      <span className="text-[9px] text-neutral-500">{v.type}</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

