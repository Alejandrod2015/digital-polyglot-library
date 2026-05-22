"use client";

import { useEffect, useState } from "react";

/**
 * "MIS VALIDACIONES" feed entre el form y el inventario.
 *
 * Cada fila lista una validación previa dedupeada por título. Click
 * en la fila expande un panel inline con el contenido (synopsis,
 * primer párrafo, vocab, validation report). Para validaciones que
 * aún no llegaron al Studio, expone un botón "Cargar en el form" que
 * devuelve el JSON al textarea para reintentar la subida con context.
 */

type ParsedStory = {
  title?: string;
  synopsis?: string;
  text?: string;
  arcType?: string | null;
  level?: string;
  topic?: string;
  vocab?: Array<{ word?: string; definition?: string; type?: string | null }>;
} | null;

type CheckItem = {
  id: string;
  // El validator usa `status: "pass"|"fail"|"warn"`, NO `ok: boolean`.
  // Schema mismatch nos hacía marcar todos los checks como fallados.
  status?: "pass" | "fail" | "warn";
  ok?: boolean; // back-compat por si algún run viejo lo tiene
  label?: string;
  detail?: string;
};

type HistoryItem = {
  runId: string;
  title: string;
  latestRunAt: string;
  attemptCount: number;
  latestStatus: string;
  stageOutcome: "staged" | "stage_blocked" | "validate_only";
  storyId: string | null;
  storyStatus: string | null;
  storyExists: boolean;
  journeyId: string | null;
  journeyName: string | null;
  journeyLanguage: string | null;
  level: string | null;
  topic: string | null;
  parsed: ParsedStory;
  raw: string | null;
  checks: CheckItem[] | null;
  summary: { pass?: number; fail?: number; warn?: number; total?: number } | null;
};

function checkPassed(c: CheckItem): boolean {
  if (typeof c.status === "string") return c.status === "pass";
  return c.ok === true;
}
function checkWarned(c: CheckItem): boolean {
  return c.status === "warn";
}
function checkFailed(c: CheckItem): boolean {
  if (typeof c.status === "string") return c.status === "fail";
  return c.ok === false;
}

type Props = {
  /** Callback: el padre intenta subir directamente la historia al
   *  Studio. Si tiene context (journey/level/topic) listo, hace POST
   *  a /stage; si no, devuelve el raw al form y pide elegir context.
   *  La row delega — no maneja el modal de confirmación ella misma. */
  onStageDirect?: (raw: string, title: string) => void;
  /** Indica si el padre tiene journey/level/topic listos. Si no,
   *  el botón "Subir al Studio" sigue habilitado pero con label
   *  "Cargar en el form" — el padre se encarga del scroll + hint. */
  contextReady?: boolean;
  /** El padre nos avisa cuando una subida desde el historial terminó
   *  para que refresquemos el feed sin esperar al refresh manual. */
  refreshSignal?: number;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "ahora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

export default function ValidationHistory({
  onStageDirect,
  contextReady = false,
  refreshSignal = 0,
}: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/validar/history", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: HistoryItem[] };
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Cuando el padre completa una subida desde el historial, vuelve a
  // pedir la lista para que el badge ✓ aparezca sin click manual.
  useEffect(() => {
    if (refreshSignal > 0) void load();
  }, [refreshSignal]);

  function toggle(runId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }

  return (
    <section className="jm-panel" style={{ padding: 16, marginBottom: 16 }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <h3
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "var(--mx-muted)",
            margin: 0,
          }}
        >
          Mis validaciones
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="jm-btn jm-btn--ghost"
          style={{ fontSize: 11, padding: "2px 8px" }}
          disabled={loading}
        >
          {loading ? "Cargando…" : "Refrescar"}
        </button>
      </header>

      {error ? (
        <p style={{ color: "var(--mx-neg)", fontSize: 12 }}>{error}</p>
      ) : loading && items.length === 0 ? (
        <p style={{ color: "var(--mx-muted)", fontSize: 12 }}>Cargando…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--mx-muted)", fontSize: 12 }}>
          Aún no has validado historias. Cuando pegues un JSON y valides,
          aparecerá aquí — y verás cuáles ya subiste al Studio.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((it) => (
            <Row
              key={it.runId}
              item={it}
              expanded={expanded.has(it.runId)}
              onToggle={() => toggle(it.runId)}
              onStageDirect={onStageDirect}
              contextReady={contextReady}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({
  item,
  expanded,
  onToggle,
  onStageDirect,
  contextReady,
}: {
  item: HistoryItem;
  expanded: boolean;
  onToggle: () => void;
  onStageDirect?: (raw: string, title: string) => void;
  contextReady: boolean;
}) {
  const outcome = item.stageOutcome;
  const isStaged = outcome === "staged" && item.storyExists;
  const isBlocked =
    outcome === "stage_blocked" || item.latestStatus === "needs_review";

  const badge = isStaged
    ? { color: "#22c55e", label: "✓ En Studio" }
    : isBlocked
      ? { color: "#f59e0b", label: "⚠ Necesita revisión" }
      : { color: "#7d8aa3", label: "Validada (no subida)" };

  const ctxParts = [
    item.journeyName,
    item.journeyLanguage,
    item.level,
    item.topic,
  ].filter(Boolean);

  return (
    <li
      style={{
        borderBottom: "1px solid var(--mx-border-soft)",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 0",
          cursor: "pointer",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: badge.color,
            flexShrink: 0,
          }}
        />
        <span
          aria-hidden
          style={{
            color: "var(--mx-muted)",
            fontSize: 10,
            transform: expanded ? "rotate(90deg)" : "none",
            transition: "transform 0.15s",
            flexShrink: 0,
          }}
        >
          ▶
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "var(--mx-fg)",
              display: "flex",
              alignItems: "baseline",
              gap: 6,
            }}
          >
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.title}
            </span>
            {item.attemptCount > 1 && (
              <span
                style={{
                  fontSize: 10,
                  color: "var(--mx-muted)",
                  fontWeight: 600,
                }}
              >
                ×{item.attemptCount}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--mx-muted)",
              display: "flex",
              gap: 8,
              marginTop: 2,
            }}
          >
            <span>{timeAgo(item.latestRunAt)}</span>
            {ctxParts.length > 0 && <span>· {ctxParts.join(" / ")}</span>}
          </div>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: badge.color,
            flexShrink: 0,
          }}
        >
          {badge.label}
        </span>
        {isStaged && item.storyId && (
          <a
            href={`/studio/journey-stories/${item.storyId}`}
            onClick={(e) => e.stopPropagation()}
            className="jm-btn jm-btn--ghost"
            style={{ fontSize: 11, padding: "3px 8px", flexShrink: 0 }}
          >
            Abrir
          </a>
        )}
      </div>

      {expanded && (
        <Detail
          item={item}
          onStageDirect={onStageDirect}
          contextReady={contextReady}
        />
      )}
    </li>
  );
}

function Detail({
  item,
  onStageDirect,
  contextReady,
}: {
  item: HistoryItem;
  onStageDirect?: (raw: string, title: string) => void;
  contextReady: boolean;
}) {
  const parsed = item.parsed;
  const vocab = Array.isArray(parsed?.vocab) ? parsed.vocab : [];
  const textExcerpt = typeof parsed?.text === "string" ? parsed.text : "";
  const allChecks = item.checks ?? [];
  const passedChecks = allChecks.filter(checkPassed);
  const warnedChecks = allChecks.filter(checkWarned);
  const failedChecks = allChecks.filter(checkFailed);

  return (
    <div
      style={{
        padding: "10px 20px 14px 28px",
        background: "var(--mx-bg-panel)",
        borderRadius: 6,
        marginBottom: 8,
      }}
    >
      {parsed?.synopsis && (
        <div style={{ marginBottom: 10 }}>
          <Label>Synopsis</Label>
          <p
            style={{
              fontSize: 12.5,
              color: "var(--mx-fg-soft)",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {parsed.synopsis}
          </p>
        </div>
      )}

      {textExcerpt && (
        <div style={{ marginBottom: 10 }}>
          <Label>Texto ({textExcerpt.trim().split(/\s+/).length} palabras)</Label>
          {/* Texto completo, sin truncar. Si la historia es larga el
              scroll interno aparece (max 480px) pero todo el contenido
              es accesible para revisión editorial. */}
          <p
            style={{
              fontSize: 12.5,
              color: "var(--mx-fg-soft)",
              lineHeight: 1.6,
              margin: 0,
              maxHeight: 480,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              padding: "4px 6px",
              background: "rgba(0,0,0,0.18)",
              borderRadius: 4,
            }}
          >
            {textExcerpt}
          </p>
        </div>
      )}

      {vocab.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <Label>Vocab ({vocab.length})</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {vocab.slice(0, 30).map((v, i) => (
              <span
                key={`${v.word}-${i}`}
                title={v.definition}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: "var(--mx-bg-panel-hi)",
                  border: "1px solid var(--mx-border-soft)",
                  color: "var(--mx-fg)",
                }}
              >
                {v.word}
                {v.type && (
                  <span style={{ color: "var(--mx-muted)", marginLeft: 4 }}>
                    {v.type}
                  </span>
                )}
              </span>
            ))}
            {vocab.length > 30 && (
              <span style={{ fontSize: 11, color: "var(--mx-muted)" }}>
                + {vocab.length - 30} más
              </span>
            )}
          </div>
        </div>
      )}

      {allChecks.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <Label>
            Validación ({passedChecks.length} ✓
            {warnedChecks.length > 0 ? ` · ${warnedChecks.length} ⚠` : ""}
            {failedChecks.length > 0 ? ` · ${failedChecks.length} ✗` : ""})
          </Label>
          {failedChecks.length === 0 && warnedChecks.length === 0 ? (
            <p style={{ fontSize: 11.5, color: "var(--mx-pos)", margin: 0 }}>
              Todos los checks pasaron.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {failedChecks.map((c) => (
                <li
                  key={c.id}
                  style={{ fontSize: 11.5, color: "var(--mx-neg)", marginBottom: 3 }}
                >
                  ✗ {c.label ?? c.id}
                  {c.detail && (
                    <span style={{ color: "var(--mx-muted)" }}> — {c.detail}</span>
                  )}
                </li>
              ))}
              {warnedChecks.map((c) => (
                <li
                  key={c.id}
                  style={{ fontSize: 11.5, color: "var(--mx-warn)", marginBottom: 3 }}
                >
                  ⚠ {c.label ?? c.id}
                  {c.detail && (
                    <span style={{ color: "var(--mx-muted)" }}> — {c.detail}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Acción directa: "↑ Subir al Studio" delega al padre.
          Si hay context (journey/level/topic) → padre POSTea al
          /stage directo con el raw + context. Si NO hay context,
          el padre carga el raw en el form y hace scroll arriba con
          el hint visual del Step 1. */}
      {!item.storyExists && item.raw && onStageDirect && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => onStageDirect(item.raw!, item.title)}
            className="jm-btn"
            style={{
              fontSize: 11,
              padding: "5px 12px",
              background: "var(--color-gold)",
              color: "#2a1a02",
              fontWeight: 700,
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            ↑ Subir al Studio
          </button>
          {!contextReady && (
            <span style={{ fontSize: 11, color: "var(--mx-muted)" }}>
              Elige journey · nivel · tema arriba primero
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 10,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        color: "var(--mx-muted)",
        margin: "0 0 4px",
      }}
    >
      {children}
    </p>
  );
}
