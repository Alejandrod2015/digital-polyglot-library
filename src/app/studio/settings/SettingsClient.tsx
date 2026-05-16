"use client";

import { useCallback, useEffect, useState } from "react";

// ── Styles ──

const ACCENT = "#fcd34d"; // gold, matches landing + iOS
const ACCENT_SOFT = "rgba(252, 211, 77, 0.14)";

const card: React.CSSProperties = {
  padding: 14, borderRadius: 10, backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)", display: "flex", flexDirection: "column", gap: 12,
};
const sectionLabel: React.CSSProperties = {
  margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color: ACCENT,
};
const btnPrimary: React.CSSProperties = {
  height: 28, padding: "0 14px", borderRadius: 6, border: "none",
  backgroundColor: ACCENT, color: "#051834", fontWeight: 800, fontSize: 11, cursor: "pointer",
};

// ── Types ──

type Settings = { testMode: boolean };
type ToggleablePermission = { id: string; label: string };
type RolePermissionsPayload = {
  toggleable: ToggleablePermission[];
  permissions: { manager: string[]; creator: string[] };
};

// ── Toggle switch ──

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: "none", padding: 2, cursor: "pointer",
        backgroundColor: checked ? ACCENT : "rgba(255,255,255,0.15)", transition: "background-color 0.2s",
        display: "flex", alignItems: "center",
      }}>
      <span style={{
        width: 18, height: 18, borderRadius: "50%", backgroundColor: "#fff",
        transform: checked ? "translateX(18px)" : "translateX(0)", transition: "transform 0.2s",
      }} />
    </button>
  );
}

// ── Component ──

export default function SettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [permissions, setPermissions] = useState<RolePermissionsPayload | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [savingPerms, setSavingPerms] = useState(false);
  const [savedPerms, setSavedPerms] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/settings");
      if (res.ok) setSettings(await res.json());
    } catch { /* ignore */ }
  }, []);

  const loadPermissions = useCallback(async () => {
    try {
      const res = await fetch("/api/studio/role-permissions");
      if (res.ok) {
        setPermissions(await res.json());
        setPermissionsError(null);
      } else if (res.status === 403) {
        setPermissionsError("Solo los admins pueden editar permisos.");
      } else if (res.status === 401) {
        setPermissionsError("Sesión no iniciada.");
      } else {
        setPermissionsError(`Error ${res.status} cargando permisos.`);
      }
    } catch (err) {
      setPermissionsError(err instanceof Error ? err.message : "Error de red");
    }
  }, []);

  useEffect(() => {
    void load();
    void loadPermissions();
  }, [load, loadPermissions]);

  async function saveSettings(updated: Settings) {
    try {
      await fetch("/api/studio/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch { /* ignore */ }
  }

  function setTestMode(v: boolean) {
    if (!settings) return;
    const updated = { ...settings, testMode: v };
    setSettings(updated);
    void saveSettings(updated);
  }

  function toggleRolePerm(role: "manager" | "creator", permId: string) {
    if (!permissions) return;
    const list = new Set(permissions.permissions[role]);
    if (list.has(permId)) list.delete(permId);
    else list.add(permId);
    setPermissions({
      ...permissions,
      permissions: { ...permissions.permissions, [role]: Array.from(list) },
    });
  }

  async function saveRolePermissions() {
    if (!permissions) return;
    setSavingPerms(true);
    setSavedPerms(false);
    try {
      const res = await fetch("/api/studio/role-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissions.permissions),
      });
      if (res.ok) {
        const fresh = await res.json();
        if (fresh.permissions) {
          setPermissions({ ...permissions, permissions: fresh.permissions });
        }
        setSavedPerms(true);
      }
    } finally {
      setSavingPerms(false);
      setTimeout(() => setSavedPerms(false), 2000);
    }
  }

  if (!settings) return <p style={{ fontSize: 11, color: "var(--muted)" }}>Cargando...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ══ Test mode ══ */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>Modo de prueba</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
              Genera historias muy cortas (~50 palabras, 3-5 vocab) para probar el sistema sin gastar tokens
            </p>
          </div>
          <Toggle checked={settings.testMode} onChange={setTestMode} />
        </div>
      </div>

      {/* ══ Role permissions ══ */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={sectionLabel}>Acceso por rol</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
              Admin siempre tiene acceso a todo. Configura qué secciones ven Manager y Creator.
            </p>
          </div>
          {permissions && (
            <button onClick={() => void saveRolePermissions()} disabled={savingPerms}
              style={{ ...btnPrimary, opacity: savingPerms ? 0.5 : 1 }}>
              {savingPerms ? "Guardando..." : savedPerms ? "Guardado" : "Guardar"}
            </button>
          )}
        </div>

        {permissionsError && (
          <p style={{ margin: 0, fontSize: 11, color: "#fca5a5" }}>{permissionsError}</p>
        )}

        {permissions && (
          <>
            <div style={{ display: "flex", alignItems: "center", padding: "4px 8px", borderBottom: "1px solid var(--card-border)" }}>
              <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Sección</span>
              <span style={{ width: 90, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Manager</span>
              <span style={{ width: 90, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Creator</span>
            </div>

            {permissions.toggleable.map((perm) => {
              const managerOn = permissions.permissions.manager.includes(perm.id);
              const creatorOn = permissions.permissions.creator.includes(perm.id);
              return (
                <div key={perm.id} style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ flex: 1, fontSize: 12, color: "var(--foreground)" }}>{perm.label}</span>
                  <span style={{ width: 90, display: "flex", justifyContent: "center" }}>
                    <input type="checkbox" checked={managerOn} onChange={() => toggleRolePerm("manager", perm.id)}
                      style={{ width: 16, height: 16, cursor: "pointer", accentColor: ACCENT }} />
                  </span>
                  <span style={{ width: 90, display: "flex", justifyContent: "center" }}>
                    <input type="checkbox" checked={creatorOn} onChange={() => toggleRolePerm("creator", perm.id)}
                      style={{ width: 16, height: 16, cursor: "pointer", accentColor: ACCENT }} />
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

    </div>
  );
}
