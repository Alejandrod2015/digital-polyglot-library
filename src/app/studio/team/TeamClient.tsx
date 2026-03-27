"use client";

import { useCallback, useEffect, useState } from "react";
import type { StudioRole } from "@/lib/studio-access";

type Member = {
  id: string;
  email: string;
  role: StudioRole;
  name: string | null;
  createdAt: string;
};

const ACCENT = "#14b8a6";
const ROLES: { value: StudioRole; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Full access including team management" },
  { value: "manager", label: "Manager", description: "Metrics, QA, Sanity, and content creation" },
  { value: "content_creator", label: "Content Creator", description: "Journey Stories and Journey Builder" },
];

const card: React.CSSProperties = {
  borderRadius: 10,
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  padding: 20,
};

const inputStyle: React.CSSProperties = {
  height: 40,
  width: "100%",
  borderRadius: 8,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  padding: "0 12px",
  fontSize: 14,
  outline: "none",
};

const btnPrimary: React.CSSProperties = {
  height: 40,
  borderRadius: 8,
  border: "none",
  backgroundColor: ACCENT,
  color: "#fff",
  padding: "0 20px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const btnDanger: React.CSSProperties = {
  ...btnPrimary,
  backgroundColor: "transparent",
  border: "1px solid rgba(239, 68, 68, 0.4)",
  color: "#ef4444",
  padding: "0 14px",
  fontSize: 13,
};

const roleBadge = (role: StudioRole): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  backgroundColor:
    role === "admin"
      ? "rgba(239, 68, 68, 0.15)"
      : role === "manager"
        ? "rgba(59, 130, 246, 0.15)"
        : "rgba(20, 184, 166, 0.15)",
  color:
    role === "admin"
      ? "#f87171"
      : role === "manager"
        ? "#60a5fa"
        : "#2dd4bf",
});

export default function TeamClient({ currentRole }: { currentRole: StudioRole }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<StudioRole>("content_creator");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<StudioRole>("content_creator");

  const isAdmin = currentRole === "admin";

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/team");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function handleAdd() {
    if (!newEmail.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole, name: newName.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setNewEmail("");
      setNewName("");
      setNewRole("content_creator");
      setShowAdd(false);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateRole(id: string, role: StudioRole) {
    setError(null);
    try {
      const res = await fetch("/api/studio/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setEditingId(null);
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function handleRemove(id: string, email: string) {
    if (!confirm(`Remove ${email} from the team?`)) return;
    setError(null);
    try {
      const res = await fetch("/api/studio/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ ...card, height: 60, opacity: 0.5 }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "flex", gap: 12 }}>
        {ROLES.map((r) => {
          const count = members.filter((m) => m.role === r.value).length;
          return (
            <div key={r.value} style={{ ...card, flex: 1, padding: 16 }}>
              <p style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{r.label}s</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: "var(--foreground)", margin: "4px 0 0" }}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 8, backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Members table */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
            Team members ({members.length})
          </h3>
          {isAdmin && (
            <button style={btnPrimary} onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? "Cancel" : "+ Add member"}
            </button>
          )}
        </div>

        {/* Add member form */}
        {showAdd && isAdmin && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Email</label>
              <input
                style={inputStyle}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                type="email"
                autoComplete="off"
              />
            </div>
            <div style={{ flex: "0 1 160px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Name (optional)</label>
              <input
                style={inputStyle}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
                autoComplete="off"
              />
            </div>
            <div style={{ flex: "0 1 180px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 4 }}>Role</label>
              <select style={inputStyle} value={newRole} onChange={(e) => setNewRole(e.target.value as StudioRole)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <button style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={() => void handleAdd()} disabled={saving}>
              {saving ? "Adding..." : "Add"}
            </button>
          </div>
        )}

        {/* Members list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {members.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 8,
                border: "1px solid var(--card-border)",
                backgroundColor: "var(--background)",
              }}
            >
              {/* Avatar placeholder */}
              <div style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: "rgba(20, 184, 166, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                color: ACCENT,
                flexShrink: 0,
              }}>
                {(m.name || m.email)[0].toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.name || m.email}
                </p>
                {m.name && (
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.email}
                  </p>
                )}
              </div>

              {/* Role badge or editor */}
              {editingId === m.id && isAdmin ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select
                    style={{ ...inputStyle, width: 160 }}
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as StudioRole)}
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <button
                    style={{ ...btnPrimary, padding: "0 12px", fontSize: 13 }}
                    onClick={() => void handleUpdateRole(m.id, editRole)}
                  >
                    Save
                  </button>
                  <button
                    style={{ ...btnDanger, borderColor: "var(--card-border)", color: "var(--muted)" }}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={roleBadge(m.role)}>
                    {ROLES.find((r) => r.value === m.role)?.label ?? m.role}
                  </span>
                  {isAdmin && (
                    <>
                      <button
                        style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 13, padding: "4px 8px" }}
                        onClick={() => { setEditingId(m.id); setEditRole(m.role); }}
                      >
                        Edit
                      </button>
                      <button
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13, padding: "4px 8px", opacity: 0.7 }}
                        onClick={() => void handleRemove(m.id, m.email)}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {members.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", padding: 20 }}>
              No team members yet. Add the first one above.
            </p>
          )}
        </div>
      </div>

      {/* Role reference */}
      <div style={card}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: "0 0 12px" }}>
          Role permissions
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ROLES.map((r) => (
            <div key={r.value} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ ...roleBadge(r.value), width: 120, textAlign: "center" }}>{r.label}</span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{r.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
