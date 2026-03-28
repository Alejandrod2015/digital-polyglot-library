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
  all: "Todos",
  draft: "Nuevo",
  generated: "Generado por IA",
  qa_pass: "Aprobado por QA",
  qa_fail: "Necesita corrección",
  needs_review: "Para revisar",
  approved: "Listo para publicar",
  published: "Publicado",
};

const STATUS_COLORS: Record<Status, string> = {
  all: "#6b7280",
  draft: "#6b7280",
  generated: "#3b82f6",
  qa_pass: "#10b981",
  qa_fail: "#f59e0b",
  needs_review: "#f59e0b",
  approved: "#14b8a6",
  published: "#10b981",
};

const EMPTY_STATE_MESSAGES: Record<Status, string> = {
  all: "No hay historias en este momento.",
  draft: "No hay historias nuevas. ¡Listo para comenzar!",
  generated: "No hay historias generadas por IA en este momento.",
  qa_pass: "No hay historias que hayan pasado QA.",
  qa_fail: "No hay historias que necesiten corrección.",
  needs_review: "No hay historias pendientes de revisión. ¡Buen trabajo!",
  approved: "No hay historias listas para publicar.",
  published: "No hay historias publicadas aún.",
};

export default function DraftsClient() {
  const [drafts, setDrafts] = useState<StoryDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<Status>("all");
  const [statusCounts, setStatusCounts] = useState<Record<Status, number>>({
    all: 0,
    draft: 0,
    generated: 0,
    qa_pass: 0,
    qa_fail: 0,
    needs_review: 0,
    approved: 0,
    published: 0,
  });
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch drafts
  useEffect(() => {
    const fetchDrafts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (activeFilter !== "all") {
          params.append("status", activeFilter);
        }
        params.append("limit", "100");

        const res = await fetch(`/api/studio/drafts?${params}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const { drafts: fetchedDrafts } = await res.json();
        setDrafts(fetchedDrafts || []);

        // Calculate counts for all filters
        const allRes = await fetch("/api/studio/drafts?limit=500", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if (allRes.ok) {
          const { drafts: allDrafts } = await allRes.json();
          const counts: Record<Status, number> = {
            all: allDrafts.length,
            draft: 0,
            generated: 0,
            qa_pass: 0,
            qa_fail: 0,
            needs_review: 0,
            approved: 0,
            published: 0,
          };

          (allDrafts || []).forEach((d: StoryDraft) => {
            counts[d.status as Status] = (counts[d.status as Status] || 0) + 1;
          });

          setStatusCounts(counts);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch drafts");
      } finally {
        setLoading(false);
      }
    };

    fetchDrafts();
  }, [activeFilter, refreshKey]);

  const handleStatusChange = async (draftId: string, newStatus: string) => {
    setUpdating(draftId);
    try {
      const res = await fetch("/api/studio/drafts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, status: newStatus }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setDrafts((prev) =>
        prev.map((d) =>
          d.id === draftId ? { ...d, status: newStatus } : d
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update draft");
    } finally {
      setUpdating(null);
    }
  };

  const handlePublish = async (draftId: string) => {
    setPublishing(draftId);
    try {
      const res = await fetch("/api/agents/drafts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setDrafts((prev) =>
          prev.map((d) =>
            d.id === draftId ? { ...d, status: "published" } : d
          )
        );
        setRefreshKey((k) => k + 1);
      } else {
        setError(data.error || "Error al publicar");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al publicar");
    } finally {
      setPublishing(null);
    }
  };

  const handleAutoPromote = async () => {
    setPromoting(true);
    setPromoteResult(null);
    try {
      const res = await fetch("/api/agents/drafts/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minScore: 90, autoPublish: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const count = data.promotedIds?.length ?? data.promoted ?? 0;
      setPromoteResult(
        count > 0
          ? `${count} borrador(es) promovido(s) a "Aprobado".`
          : "No hay borradores que cumplan los requisitos para promoción automática."
      );
      if (count > 0) {
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en auto-promoción");
    } finally {
      setPromoting(false);
    }
  };

  const wordCount = (text: string): number => text.split(/\s+/).length;

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getSourceLabel = (metadata?: any): string => {
    if (!metadata) return "Desconocido";
    if (metadata.source === "content_agent") return "Content Agent";
    if (metadata.source === "translation_agent") return "Traducción";
    return "Desconocido";
  };

  const getLanguageAndLevel = (metadata?: any): string => {
    if (!metadata) return "";
    const lang = metadata.language || "";
    const level = metadata.level || "";
    if (lang && level) return `${lang} · ${level}`;
    if (lang) return lang;
    if (level) return level;
    return "";
  };

  if (loading && drafts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Cargando borradores...</p>
      </div>
    );
  }

  const statuses: Status[] = ["all", "draft", "generated", "qa_pass", "qa_fail", "needs_review", "approved", "published"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            fontSize: 13,
          }}
        >
          Error: {error}
        </div>
      )}

      {/* Bulk actions bar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={handleAutoPromote}
          disabled={promoting}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            color: "white",
            backgroundColor: promoting ? "rgba(20, 184, 166, 0.5)" : "#14b8a6",
            cursor: promoting ? "not-allowed" : "pointer",
            transition: "background-color 0.15s",
          }}
        >
          {promoting ? "Promoviendo..." : "Aprobar automáticamente los que pasaron calidad"}
        </button>
        {promoteResult && (
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {promoteResult}
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          borderBottom: "1px solid var(--card-border)",
          paddingBottom: 12,
        }}
      >
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => {
              setActiveFilter(status);
              setExpandedDraftId(null);
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              fontSize: 13,
              fontWeight: activeFilter === status ? 600 : 500,
              color: activeFilter === status ? "white" : "var(--muted)",
              backgroundColor:
                activeFilter === status ? "var(--studio-accent, #14b8a6)" : "transparent",
              cursor: "pointer",
              transition: "background-color 0.15s, color 0.15s",
            }}
          >
            {STATUS_LABELS[status]}
            <span
              style={{
                marginLeft: 6,
                fontSize: 11,
                opacity: 0.7,
                fontWeight: 500,
              }}
            >
              ({statusCounts[status]})
            </span>
          </button>
        ))}
      </div>

      {/* Empty state */}
      {drafts.length === 0 && (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            borderRadius: 12,
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--card-border)",
          }}
        >
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            {EMPTY_STATE_MESSAGES[activeFilter]}
          </p>
        </div>
      )}

      {/* Drafts list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {drafts.map((draft) => (
          <div
            key={draft.id}
            style={{
              borderRadius: 10,
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--card-border)",
              overflow: "hidden",
              transition: "border-color 0.15s",
            }}
          >
            {/* Summary row */}
            <div
              onClick={() =>
                setExpandedDraftId(
                  expandedDraftId === draft.id ? null : draft.id
                )
              }
              style={{
                padding: "16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                backgroundColor: "var(--card-bg)",
                transition: "background-color 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "rgba(20, 184, 166, 0.05)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "var(--card-bg)";
              }}
            >
              {/* Status badge */}
              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  backgroundColor: STATUS_COLORS[draft.status as Status] + "20",
                  border: `1px solid ${STATUS_COLORS[draft.status as Status]}40`,
                  fontSize: 11,
                  fontWeight: 600,
                  color: STATUS_COLORS[draft.status as Status],
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {STATUS_LABELS[draft.status as Status] ||
                  draft.status}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <h4
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "var(--foreground)",
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {draft.title || "Sin título"}
                  </h4>
                  {getLanguageAndLevel(draft.metadata) && (
                    <div
                      style={{
                        padding: "4px 10px",
                        borderRadius: 4,
                        backgroundColor: "rgba(20, 184, 166, 0.1)",
                        border: "1px solid rgba(20, 184, 166, 0.3)",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#14b8a6",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {getLanguageAndLevel(draft.metadata)}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    fontSize: 12,
                    color: "var(--muted)",
                    flexWrap: "wrap",
                  }}
                >
                  <span>{wordCount(draft.text)} palabras</span>
                  <span>•</span>
                  <span>{formatDate(draft.updatedAt)}</span>
                  <span>•</span>
                  <span>{getSourceLabel(draft.metadata)}</span>
                </div>
              </div>

              {/* Expand icon */}
              <div
                style={{
                  fontSize: 18,
                  color: "var(--muted)",
                  transform:
                    expandedDraftId === draft.id ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                  flexShrink: 0,
                }}
              >
                ▼
              </div>
            </div>

            {/* Expanded content */}
            {expandedDraftId === draft.id && (
              <div
                style={{
                  padding: "16px",
                  borderTop: "1px solid var(--card-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {/* Text preview */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Texto
                  </label>
                  <textarea
                    readOnly
                    value={draft.text.substring(0, 500) + (draft.text.length > 500 ? "..." : "")}
                    style={{
                      width: "100%",
                      minHeight: 120,
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid var(--card-border)",
                      backgroundColor: "rgba(0, 0, 0, 0.1)",
                      color: "var(--foreground)",
                      fontSize: 13,
                      fontFamily: "monospace",
                      resize: "none",
                    }}
                  />
                </div>

                {/* Synopsis */}
                {draft.synopsis && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Sinopsis
                    </label>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "var(--foreground)",
                        lineHeight: 1.6,
                      }}
                    >
                      {draft.synopsis}
                    </p>
                  </div>
                )}

                {/* Metadata grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 12,
                  }}
                >
                  {draft.slug && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        Slug
                      </label>
                      <code
                        style={{
                          fontSize: 12,
                          color: "var(--foreground)",
                          backgroundColor: "rgba(0, 0, 0, 0.1)",
                          padding: "4px 8px",
                          borderRadius: 4,
                        }}
                      >
                        {draft.slug}
                      </code>
                    </div>
                  )}

                  {draft.vocab && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        Vocabulario
                      </label>
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--foreground)",
                          margin: 0,
                        }}
                      >
                        {Object.keys(draft.vocab).length} palabras
                      </p>
                    </div>
                  )}

                  {draft.metadata?.level && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        Nivel
                      </label>
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--foreground)",
                          margin: 0,
                        }}
                      >
                        {draft.metadata.level}
                      </p>
                    </div>
                  )}

                  {draft.metadata?.variant && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        Variante
                      </label>
                      <p
                        style={{
                          fontSize: 12,
                          color: "var(--foreground)",
                          margin: 0,
                        }}
                      >
                        {draft.metadata.variant}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={() => handleStatusChange(draft.id, "approved")}
                    disabled={updating === draft.id || draft.status === "approved"}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: "none",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "white",
                      backgroundColor:
                        updating === draft.id || draft.status === "approved"
                          ? "rgba(16, 185, 129, 0.5)"
                          : "#10b981",
                      cursor:
                        updating === draft.id || draft.status === "approved"
                          ? "not-allowed"
                          : "pointer",
                      transition: "background-color 0.15s",
                    }}
                  >
                    {updating === draft.id ? "Procesando..." : "Aprobar"}
                  </button>

                  <button
                    onClick={() => handleStatusChange(draft.id, "qa_fail")}
                    disabled={updating === draft.id || draft.status === "qa_fail"}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: "none",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "white",
                      backgroundColor:
                        updating === draft.id || draft.status === "qa_fail"
                          ? "rgba(239, 68, 68, 0.5)"
                          : "#ef4444",
                      cursor:
                        updating === draft.id || draft.status === "qa_fail"
                          ? "not-allowed"
                          : "pointer",
                      transition: "background-color 0.15s",
                    }}
                  >
                    {updating === draft.id ? "Procesando..." : "Rechazar"}
                  </button>

                  {draft.status === "approved" && (
                    <button
                      onClick={() => handlePublish(draft.id)}
                      disabled={publishing === draft.id}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        border: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "white",
                        backgroundColor:
                          publishing === draft.id
                            ? "rgba(59, 130, 246, 0.5)"
                            : "#3b82f6",
                        cursor:
                          publishing === draft.id
                            ? "not-allowed"
                            : "pointer",
                        transition: "background-color 0.15s",
                      }}
                    >
                      {publishing === draft.id ? "Publicando..." : "Publicar a Sanity"}
                    </button>
                  )}

                  <Link
                    href="/studio/qa"
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: "1px solid var(--card-border)",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--primary)",
                      backgroundColor: "transparent",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      transition: "background-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "rgba(20, 184, 166, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        "transparent";
                    }}
                  >
                    Ejecutar QA →
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
