"use client";

import { useEffect, useState } from "react";

type NotificationChannel = "local" | "remote" | "both";

type NotificationType = {
  key: string;
  label: string;
  description: string;
  title: string;
  body: string;
  hourDefault: number | null;
  localEnabledByDefault: boolean;
  channel: NotificationChannel;
  active: boolean;
  sortOrder: number;
  hasRow: boolean;
};

const ACCENT = "#fcd34d";
const CARD_BG = "#0f1f34";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const INPUT_BG = "#0a1628";

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  local: "Local (agendada en el móvil)",
  remote: "Remota (push, Fase 2)",
  both: "Local + remota",
};

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    background: INPUT_BG,
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 8,
    padding: "8px 10px",
    color: "var(--foreground)",
    fontSize: 13,
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--muted)",
    marginBottom: 4,
  };
}

export default function NotificacionesClient() {
  const [types, setTypes] = useState<NotificationType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [tab, setTab] = useState<"tipos" | "campanas">("tipos");

  useEffect(() => {
    fetch("/api/studio/notifications")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No autorizado"))))
      .then((data) => setTypes(data.types as NotificationType[]))
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"));
  }, []);

  function update(key: string, patch: Partial<NotificationType>) {
    setTypes((prev) =>
      prev ? prev.map((t) => (t.key === key ? { ...t, ...patch } : t)) : prev,
    );
    setSavedKey(null);
  }

  async function save(t: NotificationType) {
    setSavingKey(t.key);
    setError(null);
    try {
      const res = await fetch("/api/studio/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: t.key,
          label: t.label,
          description: t.description,
          title: t.title,
          body: t.body,
          hourDefault: t.hourDefault,
          localEnabledByDefault: t.localEnabledByDefault,
          channel: t.channel,
          active: t.active,
          sortOrder: t.sortOrder,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Error al guardar");
      }
      update(t.key, { hasRow: true });
      setSavedKey(t.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {(["tipos", "campanas"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              background: tab === key ? ACCENT : INPUT_BG,
              color: tab === key ? "#0a1628" : "var(--muted)",
              border: `1px solid ${tab === key ? ACCENT : CARD_BORDER}`,
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {key === "tipos" ? "Tipos" : "Campañas push"}
          </button>
        ))}
      </div>

      {tab === "campanas" ? (
        <CampaignsPanel types={types ?? []} />
      ) : error && !types ? (
        <p style={{ color: "#f87171", fontSize: 14 }}>{error}</p>
      ) : !types ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Cargando…</p>
      ) : (
        <TypesEditor types={types} error={error} savingKey={savingKey} savedKey={savedKey} update={update} save={save} />
      )}
    </div>
  );
}

type TypesEditorProps = {
  types: NotificationType[];
  error: string | null;
  savingKey: string | null;
  savedKey: string | null;
  update: (key: string, patch: Partial<NotificationType>) => void;
  save: (t: NotificationType) => void;
};

function TypesEditor({ types, error, savingKey, savedKey, update, save }: TypesEditorProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))",
        gap: 16,
        alignItems: "start",
      }}
    >
      {error ? (
        <p style={{ color: "#f87171", fontSize: 13, margin: 0, gridColumn: "1 / -1" }}>{error}</p>
      ) : null}

      {types.map((t) => (
        <div
          key={t.key}
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 12,
            padding: 18,
            opacity: t.active ? 1 : 0.7,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
                  {t.label || t.key}
                </h3>
                <code
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    background: INPUT_BG,
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  {t.key}
                </code>
                {!t.hasRow ? (
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>(default sin guardar)</span>
                ) : null}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
                {CHANNEL_LABEL[t.channel]}
              </p>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={t.active}
                onChange={(e) => update(t.key, { active: e.target.checked })}
              />
              Activo
            </label>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={labelStyle()}>Título</label>
              <input
                style={inputStyle()}
                value={t.title}
                onChange={(e) => update(t.key, { title: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle()}>Cuerpo</label>
              <textarea
                style={{ ...inputStyle(), minHeight: 56, resize: "vertical" }}
                value={t.body}
                onChange={(e) => update(t.key, { body: e.target.value })}
              />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--muted)" }}>
                Placeholders disponibles: {"{minutes}"}, {"{streak}"}, {"{count}"}, {"{storyTitle}"}.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 140px" }}>
                <label style={labelStyle()}>Hora default</label>
                <select
                  style={inputStyle()}
                  value={t.hourDefault ?? ""}
                  onChange={(e) =>
                    update(t.key, {
                      hourDefault: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                >
                  <option value="">Sin hora (por evento)</option>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h.toString().padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "1 1 140px" }}>
                <label style={labelStyle()}>Canal</label>
                <select
                  style={inputStyle()}
                  value={t.channel}
                  onChange={(e) => update(t.key, { channel: e.target.value as NotificationChannel })}
                >
                  <option value="local">Local</option>
                  <option value="remote">Remota</option>
                  <option value="both">Local + remota</option>
                </select>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={t.localEnabledByDefault}
                onChange={(e) => update(t.key, { localEnabledByDefault: e.target.checked })}
              />
              Activado por defecto para usuarios nuevos
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                onClick={() => save(t)}
                disabled={savingKey === t.key}
                style={{
                  background: ACCENT,
                  color: "#0a1628",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: savingKey === t.key ? "default" : "pointer",
                  opacity: savingKey === t.key ? 0.6 : 1,
                }}
              >
                {savingKey === t.key ? "Guardando…" : "Guardar"}
              </button>
              {savedKey === t.key ? (
                <span style={{ fontSize: 12, color: "#34d399" }}>Guardado ✓</span>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type Campaign = {
  id: string;
  title: string;
  body: string;
  notificationTypeKey: string | null;
  target: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  lastError: string | null;
  createdAt: string;
};

const STATUS_COLOR: Record<string, string> = {
  draft: "#9cb0c9",
  scheduled: "#60a5fa",
  sending: "#fbbf24",
  sent: "#34d399",
  failed: "#f87171",
};

function CampaignsPanel({ types }: { types: NotificationType[] }) {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [apnsConfigured, setApnsConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"type_subscribers" | "all">("type_subscribers");
  const [typeKey, setTypeKey] = useState<string>(types[0]?.key ?? "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/studio/notifications/campaigns");
      if (!res.ok) throw new Error("No autorizado");
      const data = await res.json();
      setCampaigns(data.campaigns as Campaign[]);
      setApnsConfigured(Boolean(data.apnsConfigured));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setError(null);
    setBusyId("create");
    try {
      const res = await fetch("/api/studio/notifications/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          target,
          notificationTypeKey: target === "type_subscribers" ? typeKey : null,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Error al crear");
      setTitle("");
      setBody("");
      setScheduledAt("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear");
    } finally {
      setBusyId(null);
    }
  }

  async function action(id: string, payload: Record<string, unknown>, method: "PATCH" | "DELETE") {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch("/api/studio/notifications/campaigns", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Error");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function preview() {
    setError(null);
    setPreviewMsg(null);
    setBusyId("preview");
    try {
      const res = await fetch("/api/studio/notifications/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          notificationTypeKey: target === "type_subscribers" ? typeKey : null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Error");
      setPreviewMsg(`Se enviaría a ${data.userCount} usuario(s) · ${data.deviceCount} dispositivo(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function testSend() {
    setError(null);
    setTestMsg(null);
    setBusyId("test");
    try {
      const res = await fetch("/api/studio/notifications/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Error");
      const reason = Array.isArray(data.results)
        ? data.results.find((r: { ok: boolean; reason?: string }) => !r.ok && r.reason)?.reason
        : undefined;
      setTestMsg(
        `Enviado a tu dispositivo: ${data.delivered}/${data.deviceCount} entregada(s)` +
          (data.failed ? `, ${data.failed} fallida(s)${reason ? ` (${reason})` : ""}.` : "."),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  const canCreate = title.trim() && body.trim() && (target === "all" || typeKey);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {apnsConfigured === false ? (
        <div
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
            color: "#fca5a5",
          }}
        >
          APNs no está configurado. Faltan variables de entorno APNS_KEY_ID, APNS_TEAM_ID,
          APNS_AUTH_KEY y APNS_BUNDLE_ID. Puedes crear y guardar campañas, pero "Enviar"
          fallará hasta configurarlas.
        </div>
      ) : null}
      {error ? <p style={{ color: "#f87171", fontSize: 13, margin: 0 }}>{error}</p> : null}

      {/* Composer */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 18, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>Nueva campaña</h3>
        <div>
          <label style={labelStyle()}>Título</label>
          <input style={inputStyle()} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle()}>Cuerpo</label>
          <textarea
            style={{ ...inputStyle(), minHeight: 56, resize: "vertical" }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 180px" }}>
            <label style={labelStyle()}>Destinatarios</label>
            <select style={inputStyle()} value={target} onChange={(e) => setTarget(e.target.value as "type_subscribers" | "all")}>
              <option value="type_subscribers">Suscriptores de un tipo</option>
              <option value="all">Todos los que tengan token</option>
            </select>
          </div>
          {target === "type_subscribers" ? (
            <div style={{ flex: "1 1 180px" }}>
              <label style={labelStyle()}>Tipo</label>
              <select style={inputStyle()} value={typeKey} onChange={(e) => setTypeKey(e.target.value)}>
                {types.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div style={{ flex: "1 1 180px" }}>
            <label style={labelStyle()}>Programar (opcional)</label>
            <input
              type="datetime-local"
              style={inputStyle()}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void create()}
            disabled={!canCreate || busyId === "create"}
            style={{
              background: ACCENT,
              color: "#0a1628",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: !canCreate || busyId === "create" ? "default" : "pointer",
              opacity: !canCreate || busyId === "create" ? 0.5 : 1,
            }}
          >
            {scheduledAt ? "Programar campaña" : "Guardar borrador"}
          </button>
          <button
            type="button"
            onClick={() => void preview()}
            disabled={busyId === "preview" || (target === "type_subscribers" && !typeKey)}
            style={{
              background: INPUT_BG,
              color: "var(--foreground)",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: busyId === "preview" ? "default" : "pointer",
            }}
          >
            {busyId === "preview" ? "Calculando…" : "Previsualizar destinatarios"}
          </button>
          <button
            type="button"
            onClick={() => void testSend()}
            disabled={busyId === "test" || !title.trim() || !body.trim()}
            style={{
              background: INPUT_BG,
              color: "var(--foreground)",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: busyId === "test" || !title.trim() || !body.trim() ? "default" : "pointer",
              opacity: !title.trim() || !body.trim() ? 0.5 : 1,
            }}
          >
            {busyId === "test" ? "Enviando…" : "Enviar prueba a mi iPhone"}
          </button>
        </div>
        {previewMsg ? <p style={{ margin: 0, fontSize: 12, color: "#60a5fa" }}>{previewMsg}</p> : null}
        {testMsg ? <p style={{ margin: 0, fontSize: 12, color: "#34d399" }}>{testMsg}</p> : null}
      </div>

      {/* List */}
      {campaigns === null ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Cargando…</p>
      ) : campaigns.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>Aún no hay campañas.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            gap: 12,
            alignItems: "start",
          }}
        >
          {campaigns.map((c) => {
          const editable = c.status === "draft" || c.status === "scheduled" || c.status === "failed";
          return (
            <div key={c.id} style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: STATUS_COLOR[c.status] ?? "#9cb0c9" }}>
                  {c.status}
                </span>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--foreground)", flex: 1 }}>{c.title}</h4>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--muted)" }}>{c.body}</p>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)" }}>
                {c.target === "all" ? "Todos con token" : `Tipo: ${c.notificationTypeKey ?? "—"}`}
                {c.scheduledAt ? ` · programada ${new Date(c.scheduledAt).toLocaleString()}` : ""}
                {c.status === "sent" ? ` · ${c.deliveredCount}/${c.recipientCount} entregadas, ${c.failedCount} fallidas` : ""}
              </p>
              {c.lastError ? (
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#fca5a5" }}>{c.lastError}</p>
              ) : null}
              <div style={{ display: "flex", gap: 8 }}>
                {c.status !== "sent" && c.status !== "sending" ? (
                  <button
                    type="button"
                    onClick={() => void action(c.id, { action: "send" }, "PATCH")}
                    disabled={busyId === c.id}
                    style={{
                      background: ACCENT,
                      color: "#0a1628",
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: busyId === c.id ? "default" : "pointer",
                      opacity: busyId === c.id ? 0.6 : 1,
                    }}
                  >
                    {busyId === c.id ? "Enviando…" : "Enviar ahora"}
                  </button>
                ) : null}
                {editable ? (
                  <button
                    type="button"
                    onClick={() => void action(c.id, {}, "DELETE")}
                    disabled={busyId === c.id}
                    style={{
                      background: "transparent",
                      color: "#f87171",
                      border: `1px solid ${CARD_BORDER}`,
                      borderRadius: 8,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: busyId === c.id ? "default" : "pointer",
                    }}
                  >
                    Eliminar
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
