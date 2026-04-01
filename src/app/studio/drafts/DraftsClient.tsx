"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StoryDraft {
  id: string;
  title: string;
  slug?: string;
  text: string;
  synopsis?: string;
  vocab?: any;
  metadata?: any;
  status: string;
  createdAt: string;
  updatedAt: string;
}

type Status = "all" | "draft" | "generated" | "qa_pass" | "qa_fail" | "needs_review" | "approved" | "published";

const STATUS_LABELS: Record<Status, string> = {
  all: "Todos", draft: "Nuevo", generated: "Generado", qa_pass: "QA OK",
  qa_fail: "QA Fail", needs_review: "Revisar", approved: "Aprobado", published: "Publicado",
};

const STATUS_COLORS: Record<Status, string> = {
  all: "#6b7280", draft: "#6b7280", generated: "#3b82f6", qa_pass: "#10b981",
  qa_fail: "#f59e0b", needs_review: "#f59e0b", approved: "#14b8a6", published: "#10b981",
};

const EMPTY_MSG: Record<Status, string> = {
  all: "No hay historias.", draft: "No hay nuevas.", generated: "No hay generadas.",
  qa_pass: "No hay aprobadas por QA.", qa_fail: "No hay rechazadas.", needs_review: "Nada por revisar.",
  approved: "No hay listas.", published: "No hay publicadas.",
};

const STATUSES: Status[] = ["all", "draft", "generated", "qa_pass", "qa_fail", "needs_review", "approved", "published"];

const pill = (active: boolean): React.CSSProperties => ({
  padding: "3px 8px", borderRadius: 99, border: "none", fontSize: 11, fontWeight: active ? 700 : 500,
  color: active ? "#fff" : "var(--muted)", cursor: "pointer",
  backgroundColor: active ? "var(--studio-accent, #14b8a6)" : "rgba(127,127,127,0.1)",
  transition: "all 0.12s",
});

const actionBtn = (color: string, disabled: boolean): React.CSSProperties => ({
  padding: "2px 8px", borderRadius: 4, border: "none", fontSize: 11, fontWeight: 600,
  color: "#fff", backgroundColor: disabled ? color + "60" : color,
  cursor: disabled ? "not-allowed" : "pointer",
});

export default function DraftsClient() {
  const [drafts, setDrafts] = useState<StoryDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<Status>("all");
  const [counts, setCounts] = useState<Record<Status, number>>(
    Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (activeFilter !== "all") params.append("status", activeFilter);
        params.append("limit", "100");
        const res = await fetch(`/api/studio/drafts?${params}`, { headers: { "Content-Type": "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { drafts: d } = await res.json();
        setDrafts(d || []);

        const allRes = await fetch("/api/studio/drafts?limit=500", { headers: { "Content-Type": "application/json" } });
        if (allRes.ok) {
          const { drafts: all } = await allRes.json();
          const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
          c.all = all.length;
          (all || []).forEach((x: StoryDraft) => { c[x.status as Status] = (c[x.status as Status] || 0) + 1; });
          setCounts(c);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [activeFilter, refreshKey]);

  const handleStatusChange = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const res = await fetch("/api/studio/drafts", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDrafts((p) => p.map((d) => (d.id === id ? { ...d, status } : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setUpdating(null); }
  };

  const handlePublish = async (id: string) => {
    setPublishing(id);
    try {
      const res = await fetch("/api/agents/drafts/publish", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setDrafts((p) => p.map((d) => (d.id === id ? { ...d, status: "published" } : d)));
        setRefreshKey((k) => k + 1);
      } else setError(data.error || "Error al publicar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al publicar");
    } finally { setPublishing(null); }
  };

  const handleAutoPromote = async () => {
    setPromoting(true);
    setPromoteResult(null);
    try {
      const res = await fetch("/api/agents/drafts/promote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minScore: 85, autoPublish: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const n = data.promotedIds?.length ?? data.promoted ?? 0;
      setPromoteResult(n > 0 ? `${n} promovido(s).` : "Ninguno califica.");
      if (n > 0) setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en auto-promocion");
    } finally { setPromoting(false); }
  };

  const wc = (t: string) => t.split(/\s+/).length;
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("es-ES", { month: "short", day: "numeric" });
  const langLevel = (m?: any) => {
    if (!m) return "";
    const l = m.language || "", lv = m.level || "";
    return l && lv ? `${l}/${lv}` : l || lv || "";
  };
  const srcLabel = (m?: any) =>
    !m ? "" : m.source === "content_agent" ? "Agent" : m.source === "translation_agent" ? "Trad" : "";

  if (loading && drafts.length === 0)
    return <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, padding: "16px 0" }}>Cargando...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {error && (
        <div style={{ padding: "4px 8px", borderRadius: 4, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 11 }}>
          {error}
        </div>
      )}

      {/* Top bar: pills + actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => { setActiveFilter(s); setExpandedId(null); }} style={pill(activeFilter === s)}>
            {STATUS_LABELS[s]} {counts[s] > 0 && <span style={{ opacity: 0.7 }}>({counts[s]})</span>}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={handleAutoPromote} disabled={promoting}
          style={{ ...actionBtn("#14b8a6", promoting), fontSize: 11, padding: "3px 10px" }}>
          {promoting ? "..." : "Auto-aprobar"}
        </button>
        {promoteResult && <span style={{ fontSize: 10, color: "var(--muted)" }}>{promoteResult}</span>}
      </div>

      {/* Empty state */}
      {drafts.length === 0 && (
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, padding: 12, margin: 0 }}>
          {EMPTY_MSG[activeFilter]}
        </p>
      )}

      {/* Table */}
      {drafts.length > 0 && (
        <div style={{ border: "1px solid var(--card-border)", borderRadius: 6, overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            display: "grid", gridTemplateColumns: "100px 1fr 60px 70px 60px 50px 24px",
            gap: 4, padding: "4px 8px", fontSize: 10, fontWeight: 700, color: "var(--muted)",
            textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "1px solid var(--card-border)",
            background: "rgba(0,0,0,0.03)",
          }}>
            <span>Estado</span><span>Titulo</span><span>Palabras</span>
            <span>Fecha</span><span>Fuente</span><span>Vocab</span><span />
          </div>

          {drafts.map((d) => (
            <div key={d.id}>
              {/* Row */}
              <div
                onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                style={{
                  display: "grid", gridTemplateColumns: "100px 1fr 60px 70px 60px 50px 24px",
                  gap: 4, padding: "5px 8px", cursor: "pointer", alignItems: "center",
                  fontSize: 12, borderBottom: "1px solid var(--card-border)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(20,184,166,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{
                  padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600,
                  color: STATUS_COLORS[d.status as Status],
                  background: (STATUS_COLORS[d.status as Status]) + "18",
                  whiteSpace: "nowrap", width: "fit-content",
                }}>
                  {STATUS_LABELS[d.status as Status] || d.status}
                </span>
                <span style={{
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontWeight: 500, color: "var(--foreground)",
                }}>
                  {d.title || "Sin titulo"}
                  {langLevel(d.metadata) && (
                    <span style={{ marginLeft: 4, fontSize: 10, color: "#14b8a6", fontWeight: 600 }}>
                      {langLevel(d.metadata)}
                    </span>
                  )}
                </span>
                <span style={{ color: "var(--muted)", fontSize: 11 }}>{wc(d.text)}</span>
                <span style={{ color: "var(--muted)", fontSize: 11 }}>{fmtDate(d.updatedAt)}</span>
                <span style={{ color: "var(--muted)", fontSize: 11 }}>{srcLabel(d.metadata)}</span>
                <span style={{ color: "var(--muted)", fontSize: 11 }}>
                  {d.vocab ? Object.keys(d.vocab).length : "-"}
                </span>
                <span style={{
                  fontSize: 10, color: "var(--muted)", transition: "transform 0.12s",
                  transform: expandedId === d.id ? "rotate(180deg)" : "none",
                }}>
                  ▾
                </span>
              </div>

              {/* Expanded detail */}
              {expandedId === d.id && (
                <div style={{
                  padding: "6px 8px 8px", borderBottom: "1px solid var(--card-border)",
                  background: "rgba(0,0,0,0.02)", display: "flex", flexDirection: "column", gap: 6,
                }}>
                  {/* Synopsis */}
                  {d.synopsis && (
                    <p style={{ margin: 0, fontSize: 11, color: "var(--foreground)", lineHeight: 1.4 }}>
                      <b style={{ color: "var(--muted)", fontSize: 10 }}>Sinopsis: </b>{d.synopsis}
                    </p>
                  )}

                  {/* Text preview */}
                  <div style={{
                    fontSize: 11, fontFamily: "monospace", color: "var(--foreground)",
                    background: "rgba(0,0,0,0.06)", borderRadius: 4, padding: "4px 6px",
                    maxHeight: 80, overflow: "auto", lineHeight: 1.35, whiteSpace: "pre-wrap",
                  }}>
                    {d.text.substring(0, 400)}{d.text.length > 400 ? "..." : ""}
                  </div>

                  {/* Inline meta */}
                  <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--muted)", flexWrap: "wrap" }}>
                    {d.slug && <span>slug: <code style={{ color: "var(--foreground)" }}>{d.slug}</code></span>}
                    {d.metadata?.level && <span>nivel: {d.metadata.level}</span>}
                    {d.metadata?.variant && <span>variante: {d.metadata.variant}</span>}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                    <button onClick={() => handleStatusChange(d.id, "approved")}
                      disabled={updating === d.id || d.status === "approved"}
                      style={actionBtn("#10b981", updating === d.id || d.status === "approved")}>
                      {updating === d.id ? "..." : "Aprobar"}
                    </button>
                    <button onClick={() => handleStatusChange(d.id, "qa_fail")}
                      disabled={updating === d.id || d.status === "qa_fail"}
                      style={actionBtn("#ef4444", updating === d.id || d.status === "qa_fail")}>
                      {updating === d.id ? "..." : "Rechazar"}
                    </button>
                    {d.status === "approved" && (
                      <button onClick={() => handlePublish(d.id)} disabled={publishing === d.id}
                        style={actionBtn("#3b82f6", publishing === d.id)}>
                        {publishing === d.id ? "..." : "Publicar"}
                      </button>
                    )}
                    <Link href="/studio/qa" style={{
                      padding: "2px 8px", borderRadius: 4, border: "1px solid var(--card-border)",
                      fontSize: 11, fontWeight: 600, color: "var(--primary)", textDecoration: "none",
                    }}>
                      QA
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
