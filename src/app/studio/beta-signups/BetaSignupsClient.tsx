"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Status = "pending" | "invited" | "accepted" | "declined";

type Signup = {
  id: string;
  email: string;
  nativeLanguage: string;
  targetLanguage: string;
  currentLevel: string;
  hasIPhone: boolean;
  currentApps: string | null;
  weeklyHours: string;
  referralSource: string | null;
  consentedAt: string;
  status: Status;
  notes: string | null;
  invitedAt: string | null;
  createdAt: string;
};

const ACCENT = "#14b8a6";

const STATUSES: { value: Status; label: string; color: string }[] = [
  { value: "pending", label: "Pending", color: "#fbbf24" },
  { value: "invited", label: "Invited", color: "#60a5fa" },
  { value: "accepted", label: "Accepted", color: "#34d399" },
  { value: "declined", label: "Declined", color: "#f87171" },
];

const HOURS_LABEL: Record<string, string> = {
  "15min": "~15 min/wk",
  "1h": "~1 h/wk",
  several_hours: "Several h/wk",
};

const card: React.CSSProperties = {
  borderRadius: 10,
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  padding: 20,
};

const inputStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 8,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  padding: "0 10px",
  fontSize: 13,
  outline: "none",
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

function statusBadge(status: Status): React.CSSProperties {
  const s = STATUSES.find((x) => x.value === status);
  const color = s?.color ?? "#9aa7bd";
  return {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: `${color}26`,
    color,
  };
}

export default function BetaSignupsClient() {
  const [rows, setRows] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/beta-signups");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Signup[];
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load signups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const out: Record<Status | "all", number> = {
      all: rows.length,
      pending: 0,
      invited: 0,
      accepted: 0,
      declined: 0,
    };
    for (const r of rows) out[r.status]++;
    return out;
  }, [rows]);

  const visible = useMemo(() => {
    return filter === "all" ? rows : rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  async function updateStatus(id: string, status: Status) {
    setError(null);
    try {
      const res = await fetch("/api/studio/beta-signups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function saveNotes(id: string) {
    setError(null);
    try {
      const res = await fetch("/api/studio/beta-signups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notes: draftNotes }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      setEditingNotesId(null);
      setDraftNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save notes");
    }
  }

  async function remove(id: string, email: string) {
    if (!confirm(`Delete signup from ${email}? This cannot be undone.`)) return;
    setError(null);
    try {
      const res = await fetch("/api/studio/beta-signups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  function exportCsv() {
    const header = [
      "email",
      "nativeLanguage",
      "targetLanguage",
      "currentLevel",
      "hasIPhone",
      "weeklyHours",
      "currentApps",
      "referralSource",
      "status",
      "createdAt",
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.email,
          r.nativeLanguage,
          r.targetLanguage,
          r.currentLevel,
          r.hasIPhone ? "yes" : "no",
          r.weeklyHours,
          r.currentApps ?? "",
          r.referralSource ?? "",
          r.status,
          r.createdAt,
        ]
          .map(escape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beta-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...card, height: 80, opacity: 0.5 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {(["all", ...STATUSES.map((s) => s.value)] as const).map((key) => {
          const isActive = filter === key;
          const label = key === "all" ? "All" : STATUSES.find((s) => s.value === key)?.label;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                ...card,
                flex: "1 1 140px",
                padding: 16,
                cursor: "pointer",
                outline: isActive ? `2px solid ${ACCENT}` : "none",
              }}
            >
              <p style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, textAlign: "left", margin: 0 }}>
                {label}
              </p>
              <p style={{ fontSize: 24, fontWeight: 700, color: "var(--foreground)", margin: "4px 0 0", textAlign: "left" }}>
                {counts[key]}
              </p>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
          {visible.length} signup{visible.length === 1 ? "" : "s"}
        </h3>
        <button style={btn} onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visible.map((r) => (
          <div key={r.id} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{r.email}</p>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0" }}>
                  {new Date(r.createdAt).toLocaleString()}
                  {!r.hasIPhone && (
                    <span style={{ marginLeft: 8, color: "#f87171", fontWeight: 600 }}>· no iPhone</span>
                  )}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={statusBadge(r.status)}>{STATUSES.find((s) => s.value === r.status)?.label}</span>
                <select
                  style={{ ...inputStyle, height: 28, fontSize: 12 }}
                  value={r.status}
                  onChange={(e) => void updateStatus(r.id, e.target.value as Status)}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button style={{ ...ghostBtn, color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }} onClick={() => void remove(r.id, r.email)}>
                  Delete
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
                fontSize: 13,
                color: "var(--foreground)",
              }}
            >
              <Field label="Native" value={r.nativeLanguage} />
              <Field label="Target" value={r.targetLanguage} />
              <Field label="Level" value={r.currentLevel} />
              <Field label="Weekly time" value={HOURS_LABEL[r.weeklyHours] ?? r.weeklyHours} />
              {r.referralSource && <Field label="Heard via" value={r.referralSource} />}
            </div>

            {r.currentApps && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, margin: "0 0 4px" }}>Current apps / frustrations</p>
                <p style={{ fontSize: 13, color: "var(--foreground)", margin: 0, whiteSpace: "pre-wrap" }}>{r.currentApps}</p>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, margin: "0 0 4px" }}>Admin notes</p>
              {editingNotesId === r.id ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <textarea
                    style={{ ...inputStyle, height: 60, padding: "8px 10px", flex: 1, resize: "vertical" }}
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <button style={btn} onClick={() => void saveNotes(r.id)}>Save</button>
                    <button
                      style={ghostBtn}
                      onClick={() => {
                        setEditingNotesId(null);
                        setDraftNotes("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{ fontSize: 13, color: r.notes ? "var(--foreground)" : "var(--muted)", cursor: "pointer", whiteSpace: "pre-wrap" }}
                  onClick={() => {
                    setEditingNotesId(r.id);
                    setDraftNotes(r.notes ?? "");
                  }}
                >
                  {r.notes || "Click to add notes..."}
                </div>
              )}
            </div>
          </div>
        ))}

        {visible.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: 24 }}>
            No signups in this filter.
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, margin: "0 0 2px" }}>{label}</p>
      <p style={{ fontSize: 13, color: "var(--foreground)", margin: 0 }}>{value}</p>
    </div>
  );
}
