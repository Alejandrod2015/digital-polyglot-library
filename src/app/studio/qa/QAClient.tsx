"use client";

import { useState, useEffect } from "react";
import type { QAReport, QAIssue } from "@/app/api/studio/qa/route";

type Filter = "all" | "critical" | "warning" | "info";
type CategoryFilter = string;

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.3)", text: "#ef4444", dot: "#ef4444" },
  warning: { bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.3)", text: "#f59e0b", dot: "#f59e0b" },
  info: { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.3)", text: "#3b82f6", dot: "#3b82f6" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const c = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.info;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        padding: "3px 8px",
        borderRadius: 6,
        backgroundColor: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {severity}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderRadius: 10,
        backgroundColor: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        textAlign: "center",
        flex: 1,
        minWidth: 100,
      }}
    >
      <p style={{ fontSize: 28, fontWeight: 700, color, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", margin: "4px 0 0" }}>
        {label}
      </p>
    </div>
  );
}

function IssueCard({ issue }: { issue: QAIssue }) {
  const [expanded, setExpanded] = useState(false);
  const c = SEVERITY_COLORS[issue.severity] ?? SEVERITY_COLORS.info;

  return (
    <div
      style={{
        backgroundColor: "var(--card-bg)",
        border: `1px solid var(--card-border)`,
        borderLeft: `3px solid ${c.dot}`,
        borderRadius: 10,
        padding: "14px 18px",
        cursor: "pointer",
        transition: "background-color 0.15s",
      }}
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => e.key === "Enter" && setExpanded(!expanded)}
      role="button"
      tabIndex={0}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <SeverityBadge severity={issue.severity} />
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)", padding: "2px 6px", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 4 }}>
          {issue.id}
        </span>
        <span style={{ fontSize: 11, color: "var(--muted)", backgroundColor: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 4 }}>
          {issue.category}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", flex: 1, minWidth: 200 }}>
          {issue.title}
        </span>
        <span style={{ fontSize: 18, color: "var(--muted)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          ▾
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--card-border)" }}>
          <p style={{ fontSize: 13, fontFamily: "monospace", color: "var(--studio-accent, #14b8a6)", margin: "0 0 10px", wordBreak: "break-all" }}>
            {issue.file}
          </p>
          <p style={{ fontSize: 14, color: "var(--foreground)", margin: "0 0 10px", lineHeight: 1.6 }}>
            {issue.description}
          </p>
          <p style={{ fontSize: 13, color: "#a78bfa", margin: "0 0 10px" }}>
            <strong style={{ color: "#7c3aed" }}>Afecta a: </strong>
            {issue.affected}
          </p>
          <div
            style={{
              fontSize: 13,
              color: "#7dd3a0",
              backgroundColor: "rgba(125, 211, 160, 0.06)",
              border: "1px solid rgba(125, 211, 160, 0.15)",
              borderRadius: 8,
              padding: "10px 14px",
              lineHeight: 1.5,
            }}
          >
            <strong>Fix: </strong>{issue.fix}
          </div>
        </div>
      )}
    </div>
  );
}

export default function QAClient() {
  const [report, setReport] = useState<QAReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  useEffect(() => {
    fetch("/api/studio/qa")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: QAReport) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="studio-skeleton" style={{ height: 80 }} />
        <div style={{ display: "flex", gap: 12 }}>
          {[1, 2, 3, 4].map((i) => <div key={i} className="studio-skeleton" style={{ height: 80, flex: 1 }} />)}
        </div>
        {[1, 2, 3].map((i) => <div key={i} className="studio-skeleton" style={{ height: 56 }} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, borderRadius: 10, backgroundColor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#ef4444", margin: 0 }}>Error al cargar el reporte</p>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "6px 0 0" }}>{error}</p>
      </div>
    );
  }

  if (!report || report.issues.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <p style={{ fontSize: 40, margin: "0 0 12px" }}>🛡️</p>
        <p style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>No hay issues reportados</p>
        <p style={{ fontSize: 14, color: "var(--muted)", margin: "8px 0 0" }}>
          Ejecuta una auditoría para escanear la app.
        </p>
      </div>
    );
  }

  const categories = Array.from(new Set(report.issues.map((i) => i.category)));

  const filtered = report.issues.filter((issue) => {
    if (filter !== "all" && issue.severity !== filter) return false;
    if (categoryFilter !== "all" && issue.category !== categoryFilter) return false;
    return true;
  });

  const date = new Date(report.generatedAt);
  const formattedDate = date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatCard label="Critical" value={report.summary.critical} color="#ef4444" />
        <StatCard label="Warning" value={report.summary.warning} color="#f59e0b" />
        <StatCard label="Info" value={report.summary.info} color="#3b82f6" />
        <StatCard label="Total" value={report.summary.total} color="var(--foreground)" />
      </div>

      {/* Meta */}
      <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
        Última auditoría: {formattedDate}
      </p>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "var(--muted)", marginRight: 4 }}>Filtrar:</span>
        {(["all", "critical", "warning", "info"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontSize: 12,
              fontWeight: filter === f ? 600 : 500,
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid",
              borderColor: filter === f ? "var(--studio-accent, #14b8a6)" : "var(--card-border)",
              backgroundColor: filter === f ? "var(--studio-accent-soft, rgba(20,184,166,0.15))" : "transparent",
              color: filter === f ? "var(--studio-accent, #14b8a6)" : "var(--muted)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {f === "all" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        <span style={{ width: 1, height: 20, backgroundColor: "var(--card-border)", margin: "0 4px" }} />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            fontSize: 12,
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid var(--card-border)",
            backgroundColor: "var(--card-bg)",
            color: "var(--foreground)",
            cursor: "pointer",
          }}
        >
          <option value="all">Todas las categorías</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
          {filtered.length} issue{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Issues */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
        {filtered.length === 0 && (
          <p style={{ textAlign: "center", color: "var(--muted)", padding: 32, fontSize: 14 }}>
            No hay issues con estos filtros.
          </p>
        )}
      </div>
    </div>
  );
}
