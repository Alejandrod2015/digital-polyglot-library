"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PlannerMode = "gaps" | "create-journey";
type PlannerScope = "full" | "language" | "journey";

type PlannerGap = {
  language: string;
  variant: string;
  level: string;
  journeyTopic: string;
  storySlot: number;
  journeyFocus: string;
  reason: "missing" | "incomplete";
};

type PlannerAgentRun = {
  runId: string;
  agent: string;
  status: string;
  startedAt: string;
  completedAt: string;
  input: Record<string, unknown>;
  output: {
    status: string;
    totalStoriesAnalyzed?: number;
    gapsFound?: number;
    briefsCreated?: number;
    journeysProposed?: number;
    journeysCreated?: number;
    gaps?: PlannerGap[];
    proposals?: PlannerProposal[];
    summary: string;
  };
  toolsUsed: Array<{ toolName: string; summary: string }>;
};

type PlannerBrief = {
  id: string;
  title: string;
  language: string;
  level: string;
  storySlot: number;
  status: string;
  createdAt: string;
};

type PlannerProposal = {
  language: string;
  variant: string;
  topicSlug: string;
  topicLabel: string;
  levels: string[];
  storiesPerLevel: number;
};

type PlannerConfig = {
  defaultGapScope: PlannerScope;
  defaultGapLanguage: string;
  availableLanguages: string[];
  availableLevels: string[];
  defaultTargetLanguages: string[];
  defaultTargetLevels: string[];
  defaultStoriesPerLevel: number;
  expectedSlotsPerTopic: number;
  maxVisibleGaps: number;
};

type PlannerConfigResponse = {
  source: "database" | "defaults";
  config: PlannerConfig;
  defaults: PlannerConfig;
  updatedBy: string | null;
  updatedAt: string | null;
  canEdit: boolean;
};

type AgentRun = {
  id?: string;
  runId?: string;
  agent?: string;
  agentKind?: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  output?: Record<string, unknown> | null;
};

/* ── shared compact styles ────────────────────────────── */

const pill = (active: boolean): React.CSSProperties => ({
  padding: "4px 10px",
  borderRadius: 99,
  border: `1px solid ${active ? "var(--studio-accent, #14b8a6)" : "var(--card-border)"}`,
  backgroundColor: active ? "var(--studio-accent-soft, rgba(20,184,166,0.15))" : "transparent",
  color: active ? "var(--studio-accent, #14b8a6)" : "var(--muted)",
  fontSize: 11,
  fontWeight: active ? 700 : 500,
  cursor: "pointer",
  transition: "all 0.12s",
  whiteSpace: "nowrap" as const,
});

const card: React.CSSProperties = {
  padding: 10,
  borderRadius: 8,
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const inp: React.CSSProperties = {
  height: 30,
  borderRadius: 6,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  padding: "0 8px",
  fontSize: 12,
};

const tinyLabel: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: "var(--muted)", margin: 0 };
const sectionHead: React.CSSProperties = { margin: 0, fontSize: 13, fontWeight: 700, color: "var(--foreground)" };
const mutedTxt: React.CSSProperties = { margin: 0, fontSize: 11, color: "var(--muted)" };
const statusPill = (bg: string, fg: string): React.CSSProperties => ({
  fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em",
  padding: "2px 6px", borderRadius: 4, backgroundColor: bg, color: fg, whiteSpace: "nowrap",
});

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  height: 30, borderRadius: 6, border: "none", backgroundColor: "var(--primary)",
  color: "#fff", fontWeight: 700, padding: "0 12px", fontSize: 12,
  cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
});

const btnGhost: React.CSSProperties = {
  height: 26, borderRadius: 5, border: "1px solid var(--card-border)",
  backgroundColor: "transparent", color: "var(--foreground)", fontSize: 11,
  fontWeight: 600, padding: "0 8px", cursor: "pointer",
};

/* ── collapsible section ──────────────────────────────── */

function Collapsible({ title, badge, defaultOpen = false, children }: {
  title: React.ReactNode; badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...card, gap: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          all: "unset", cursor: "pointer", display: "flex", alignItems: "center",
          gap: 6, width: "100%", padding: "2px 0",
        }}
      >
        <span style={{ fontSize: 10, color: "var(--muted)", transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "rotate(0)" }}>&#9654;</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", flex: 1 }}>{title}</span>
        {badge}
      </button>
      {open && <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>}
    </div>
  );
}

/* ── brief level group ────────────────────────────────── */

function BriefLevelGroup({ level, briefs, router }: { level: string; briefs: PlannerBrief[]; router: ReturnType<typeof useRouter> }) {
  const [open, setOpen] = useState(false);
  const counts: Record<string, number> = {};
  briefs.forEach((b) => { counts[b.status] = (counts[b.status] || 0) + 1; });
  const summary = Object.entries(counts).map(([s, c]) => `${c} ${s}`).join(", ");

  return (
    <div style={{ borderRadius: 6, border: "1px solid var(--card-border)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          all: "unset", cursor: "pointer", display: "flex", alignItems: "center",
          gap: 6, width: "100%", padding: "5px 8px", backgroundColor: open ? "rgba(255,255,255,0.03)" : "transparent",
        }}
      >
        <span style={{ fontSize: 9, color: "var(--muted)", transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "rotate(0)" }}>&#9654;</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--studio-accent, #14b8a6)" }}>{level.toUpperCase()}</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{briefs.length} brief{briefs.length !== 1 ? "s" : ""}</span>
        <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>{summary}</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "2px 4px 4px" }}>
          {briefs.map((brief) => (
            <div key={brief.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px", borderRadius: 4, fontSize: 11 }}>
              <span style={statusPill("rgba(20,184,166,0.12)", "var(--studio-accent, #14b8a6)")}>{brief.status}</span>
              <span style={{ flex: 1, color: "var(--foreground)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brief.title}</span>
              <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{brief.language} S{brief.storySlot}</span>
              <button onClick={() => router.push("/studio/journey-stories")} style={{ ...btnGhost, height: 20, fontSize: 10, padding: "0 6px" }}>
                Generar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── main component ───────────────────────────────────── */

export default function PlannerClient() {
  const router = useRouter();
  const [plannerConfig, setPlannerConfig] = useState<PlannerConfig | null>(null);
  const [plannerConfigDraft, setPlannerConfigDraft] = useState<PlannerConfig | null>(null);
  const [plannerConfigDefaults, setPlannerConfigDefaults] = useState<PlannerConfig | null>(null);
  const [plannerConfigSource, setPlannerConfigSource] = useState<"database" | "defaults">("defaults");
  const [plannerConfigUpdatedBy, setPlannerConfigUpdatedBy] = useState<string | null>(null);
  const [plannerConfigUpdatedAt, setPlannerConfigUpdatedAt] = useState<string | null>(null);
  const [plannerConfigCanEdit, setPlannerConfigCanEdit] = useState(false);
  const [plannerConfigLoading, setPlannerConfigLoading] = useState(true);
  const [plannerConfigSaving, setPlannerConfigSaving] = useState(false);
  const [plannerConfigError, setPlannerConfigError] = useState<string | null>(null);
  const [plannerConfigMessage, setPlannerConfigMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [plannerConfigDirty, setPlannerConfigDirty] = useState(false);

  const [mode, setMode] = useState<PlannerMode>("gaps");
  const [scope, setScope] = useState<PlannerScope>("full");
  const [language, setLanguage] = useState("es");
  const [variant, setVariant] = useState("");
  const [journeyTopic, setJourneyTopic] = useState("");

  const [topicSlug, setTopicSlug] = useState("");
  const [topicLabel, setTopicLabel] = useState("");
  const [targetLanguages, setTargetLanguages] = useState<Set<string>>(new Set(["es"]));
  const [targetLevels, setTargetLevels] = useState<Set<string>>(new Set(["a1", "a2", "b1", "b2"]));
  const [storiesPerLevel, setStoriesPerLevel] = useState(4);

  const [agentRun, setAgentRun] = useState<PlannerAgentRun | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  const [briefs, setBriefs] = useState<PlannerBrief[]>([]);
  const [brieferLoading, setBrieferLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefLanguageFilter, setBriefLanguageFilter] = useState("all");
  const [briefLevelFilter, setBriefLevelFilter] = useState("all");
  const [briefStatusFilter, setBriefStatusFilter] = useState("all");

  const [runHistory, setRunHistory] = useState<AgentRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const LANGUAGES = plannerConfigDraft?.availableLanguages ?? plannerConfig?.availableLanguages ?? ["es", "pt", "fr", "it", "de", "ko", "en"];
  const LEVELS = plannerConfigDraft?.availableLevels ?? plannerConfig?.availableLevels ?? ["a1", "a2", "b1", "b2", "c1"];

  /* ── data loaders ─────────────────────────────────── */

  const loadPlannerConfig = useCallback(async () => {
    setPlannerConfigLoading(true);
    setPlannerConfigError(null);
    try {
      const res = await fetch("/api/studio/planner/config");
      if (res.status === 401) { router.push("/sign-in?redirect_url=/studio/planner"); return; }
      if (!res.ok) { const d = (await res.json().catch(() => null)) as { error?: string } | null; throw new Error(d?.error ?? `HTTP ${res.status}`); }
      const data = (await res.json()) as PlannerConfigResponse;
      setPlannerConfig(data.config);
      setPlannerConfigDraft(data.config);
      setPlannerConfigDefaults(data.defaults);
      setPlannerConfigSource(data.source);
      setPlannerConfigUpdatedBy(data.updatedBy);
      setPlannerConfigUpdatedAt(data.updatedAt);
      setPlannerConfigCanEdit(data.canEdit);
      setPlannerConfigDirty(false);
      setScope(data.config.defaultGapScope);
      setLanguage(data.config.defaultGapLanguage);
      setTargetLanguages(new Set(data.config.defaultTargetLanguages));
      setTargetLevels(new Set(data.config.defaultTargetLevels));
      setStoriesPerLevel(data.config.defaultStoriesPerLevel);
    } catch (err) {
      setPlannerConfigError(err instanceof Error ? err.message : "No se pudo cargar la configuración del planner.");
    } finally { setPlannerConfigLoading(false); }
  }, [router]);

  const loadBriefs = useCallback(async () => {
    setBrieferLoading(true);
    setBriefError(null);
    try {
      const params = new URLSearchParams();
      if (briefLanguageFilter !== "all") params.append("language", briefLanguageFilter);
      if (briefLevelFilter !== "all") params.append("level", briefLevelFilter);
      if (briefStatusFilter !== "all") params.append("status", briefStatusFilter);
      const res = await fetch(`/api/agents/planner/briefs?${params.toString()}`);
      if (res.status === 401) { router.push("/sign-in?redirect_url=/studio/planner"); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { briefs: PlannerBrief[] };
      setBriefs(data.briefs);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : "No se pudieron cargar los briefs.");
    } finally { setBrieferLoading(false); }
  }, [briefLanguageFilter, briefLevelFilter, briefStatusFilter, router]);

  const loadRunHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/runs?kind=planner&limit=10");
      if (res.status === 401) { router.push("/sign-in?redirect_url=/studio/planner"); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { runs: AgentRun[] };
      setRunHistory(data.runs);
      setHistoryError(null);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "No se pudo cargar el historial de ejecuciones.");
    } finally { setHistoryLoading(false); }
  }, [router]);

  useEffect(() => { void loadPlannerConfig(); void loadRunHistory(); void loadBriefs(); }, [loadBriefs, loadPlannerConfig, loadRunHistory]);
  useEffect(() => { void loadBriefs(); }, [loadBriefs]);

  /* ── config helpers ───────────────────────────────── */

  const updatePlannerConfig = <K extends keyof PlannerConfig>(field: K, value: PlannerConfig[K]) => {
    setPlannerConfigDraft((c) => c ? { ...c, [field]: value } : c);
    setPlannerConfigDirty(true);
  };

  const updatePlannerConfigList = (field: "availableLanguages" | "availableLevels" | "defaultTargetLanguages" | "defaultTargetLevels", value: string) => {
    const items = value.split(",").map((i) => i.trim().toLowerCase()).filter(Boolean);
    updatePlannerConfig(field, Array.from(new Set(items)) as PlannerConfig[typeof field]);
  };

  const savePlannerConfig = async () => {
    if (!plannerConfigDraft || !plannerConfigCanEdit) return;
    setPlannerConfigSaving(true);
    setPlannerConfigMessage(null);
    try {
      const res = await fetch("/api/studio/planner/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: plannerConfigDraft }) });
      const data = (await res.json().catch(() => null)) as Partial<PlannerConfigResponse> & { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      if (data?.config) {
        setPlannerConfig(data.config); setPlannerConfigDraft(data.config); setPlannerConfigSource("database");
        setPlannerConfigUpdatedBy(data.updatedBy ?? null); setPlannerConfigUpdatedAt(data.updatedAt ?? null);
        setPlannerConfigDirty(false); setScope(data.config.defaultGapScope); setLanguage(data.config.defaultGapLanguage);
        setTargetLanguages(new Set(data.config.defaultTargetLanguages)); setTargetLevels(new Set(data.config.defaultTargetLevels));
        setStoriesPerLevel(data.config.defaultStoriesPerLevel);
      }
      setPlannerConfigMessage({ type: "ok", text: "Configuración guardada." });
    } catch (err) {
      setPlannerConfigMessage({ type: "error", text: err instanceof Error ? err.message : "Error al guardar." });
    } finally { setPlannerConfigSaving(false); }
  };

  const resetPlannerConfig = async () => {
    if (!plannerConfigCanEdit) return;
    setPlannerConfigSaving(true);
    setPlannerConfigMessage(null);
    try {
      const res = await fetch("/api/studio/planner/config", { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as Partial<PlannerConfigResponse> & { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      await loadPlannerConfig();
      setPlannerConfigMessage({ type: "ok", text: "Restaurada a defaults." });
    } catch (err) {
      setPlannerConfigMessage({ type: "error", text: err instanceof Error ? err.message : "Error al restaurar." });
    } finally { setPlannerConfigSaving(false); }
  };

  /* ── agent runner ─────────────────────────────────── */

  async function runPlannerAgent() {
    setAgentError(null);
    setAgentRunning(true);
    try {
      let body: Record<string, unknown> = {};
      if (mode === "gaps") {
        body = { mode: "gaps", scope };
        if (scope === "language") { body.language = language; body.variant = variant; }
        else if (scope === "journey") { body.journeyTopic = journeyTopic; }
      } else {
        body = { mode: "create-journey", newJourneyTopic: topicSlug, newJourneyTopicLabel: topicLabel, targetLanguages: Array.from(targetLanguages), targetLevels: Array.from(targetLevels), storiesPerLevel };
      }
      const res = await fetch("/api/agents/planner/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.status === 401) { router.push("/sign-in?redirect_url=/studio/planner"); return; }
      if (!res.ok) { const b = (await res.json().catch(() => null)) as { error?: string } | null; throw new Error(b?.error ?? `HTTP ${res.status}`); }
      const data = (await res.json()) as PlannerAgentRun;
      setAgentRun(data);
      setHistoryLoading(true);
      await loadRunHistory();
      await loadBriefs();
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "Error al ejecutar Planner Agent.");
    } finally { setAgentRunning(false); }
  }

  /* ── derived data ─────────────────────────────────── */

  const uniqueLanguages = Array.from(new Set(briefs.map((b) => b.language)));
  const uniqueLevels = Array.from(new Set(briefs.map((b) => b.level)));
  const uniqueStatuses = Array.from(new Set(briefs.map((b) => b.status)));

  const filteredBriefs = briefs.filter((b) => {
    if (briefLanguageFilter !== "all" && b.language !== briefLanguageFilter) return false;
    if (briefLevelFilter !== "all" && b.level !== briefLevelFilter) return false;
    if (briefStatusFilter !== "all" && b.status !== briefStatusFilter) return false;
    return true;
  });

  // Group filtered briefs by level
  const briefsByLevel: Record<string, PlannerBrief[]> = {};
  filteredBriefs.forEach((b) => { (briefsByLevel[b.level] ??= []).push(b); });
  const sortedLevelKeys = Object.keys(briefsByLevel).sort();

  const toggleSet = (set: Set<string>, val: string) => {
    const n = new Set(set);
    n.has(val) ? n.delete(val) : n.add(val);
    return n;
  };

  /* ── render ───────────────────────────────────────── */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* ── mode pills ────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button onClick={() => setMode("gaps")} style={pill(mode === "gaps")}>Buscar faltantes</button>
        <button onClick={() => setMode("create-journey")} style={pill(mode === "create-journey")}>Crear journey</button>
        <span style={{ ...mutedTxt, marginLeft: "auto", fontSize: 10 }}>
          {mode === "gaps" ? "Busca historias que faltan en el catálogo." : "Crea un journey nuevo con sus historias."}
        </span>
      </div>

      {/* ── gap detection panel ───────────────────────── */}
      {mode === "gaps" && (
        <div style={card}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={tinyLabel}>Alcance</span>
            {(["full", "language", "journey"] as PlannerScope[]).map((s) => (
              <button key={s} onClick={() => setScope(s)} style={pill(scope === s)}>
                {s === "full" ? "Completo" : s === "language" ? "Idioma" : "Journey"}
              </button>
            ))}

            {scope === "language" && (
              <>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ ...inp, width: 60 }}>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                </select>
                <input type="text" value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="Variante" style={{ ...inp, width: 80 }} />
              </>
            )}
            {scope === "journey" && (
              <input type="text" value={journeyTopic} onChange={(e) => setJourneyTopic(e.target.value)} placeholder="Topic: coffee, travel..." style={{ ...inp, flex: 1, minWidth: 120 }} />
            )}
            {scope === "full" && <span style={{ ...mutedTxt, fontSize: 10 }}>Recorre todo el catalogo</span>}

            <button
              onClick={() => void runPlannerAgent()}
              disabled={agentRunning || (scope === "journey" && !journeyTopic)}
              style={{ ...btnPrimary(agentRunning || (scope === "journey" && !journeyTopic)), marginLeft: "auto" }}
            >
              {agentRunning ? "Analizando..." : "Analizar"}
            </button>
          </div>
          {agentError && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>{agentError}</p>}
        </div>
      )}

      {/* ── create journey panel ──────────────────────── */}
      {mode === "create-journey" && (
        <div style={card}>
          <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={tinyLabel}>Nombre del tema *</span>
              <input type="text" value={topicLabel} onChange={(e) => { setTopicLabel(e.target.value); setTopicSlug(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")); }} placeholder="Ej: Coffee Culture" style={{ ...inp, width: 180 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={tinyLabel}>Historias/tema</span>
              <input type="number" min={1} value={storiesPerLevel} onChange={(e) => setStoriesPerLevel(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...inp, width: 50 }} />
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={tinyLabel}>Idiomas</span>
              <div style={{ display: "flex", gap: 3 }}>
                {LANGUAGES.map((l) => (
                  <button key={l} onClick={() => setTargetLanguages(toggleSet(targetLanguages, l))} style={pill(targetLanguages.has(l))}>{l.toUpperCase()}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={tinyLabel}>Niveles</span>
              <div style={{ display: "flex", gap: 3 }}>
                {LEVELS.map((l) => (
                  <button key={l} onClick={() => setTargetLevels(toggleSet(targetLevels, l))} style={pill(targetLevels.has(l))}>{l.toUpperCase()}</button>
                ))}
              </div>
            </div>

            <button
              onClick={() => void runPlannerAgent()}
              disabled={agentRunning || !topicSlug || !topicLabel || targetLanguages.size === 0 || targetLevels.size === 0}
              style={{ ...btnPrimary(agentRunning || !topicSlug || !topicLabel || targetLanguages.size === 0 || targetLevels.size === 0), marginLeft: "auto" }}
            >
              {agentRunning ? "Creando..." : "Crear"}
            </button>
          </div>
          {agentError && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>{agentError}</p>}
        </div>
      )}

      {/* ── agent run result (inline) ─────────────────── */}
      {agentRun && (
        <div style={{ ...card, borderLeft: "3px solid #7dd3a0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={statusPill("rgba(125,211,160,0.15)", "#7dd3a0")}>{agentRun.output.status}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>
              {mode === "gaps" ? "Análisis completado" : "Journey creado"}
            </span>
            {agentRun.output.totalStoriesAnalyzed != null && <span style={mutedTxt}>Analizadas: <strong>{agentRun.output.totalStoriesAnalyzed}</strong></span>}
            {agentRun.output.gapsFound != null && <span style={{ ...mutedTxt, color: "#ef4444" }}>Faltantes: <strong>{agentRun.output.gapsFound}</strong></span>}
            {agentRun.output.briefsCreated != null && <span style={{ ...mutedTxt, color: "#7dd3a0" }}>Pendientes creados: <strong>{agentRun.output.briefsCreated}</strong></span>}
            {agentRun.output.journeysProposed != null && <span style={mutedTxt}>Propuestos: <strong>{agentRun.output.journeysProposed}</strong></span>}
            {agentRun.output.journeysCreated != null && <span style={{ ...mutedTxt, color: "#7dd3a0" }}>Creados: <strong>{agentRun.output.journeysCreated}</strong></span>}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--foreground)", lineHeight: 1.5 }}>{agentRun.output.summary}</p>

          {/* gaps */}
          {agentRun.output.gaps && agentRun.output.gaps.length > 0 && (
            <Collapsible title={`Gaps (${agentRun.output.gaps.length})`} defaultOpen={agentRun.output.gaps.length <= 8}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {agentRun.output.gaps.map((gap, i) => {
                  const isMissing = gap.reason === "missing";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px", borderRadius: 4, borderLeft: `2px solid ${isMissing ? "#ef4444" : "#f59e0b"}`, fontSize: 11 }}>
                      <span style={statusPill(isMissing ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)", isMissing ? "#ef4444" : "#f59e0b")}>{isMissing ? "Falta" : "Incompleto"}</span>
                      <span style={{ color: "var(--foreground)", fontWeight: 500 }}>S{gap.storySlot}</span>
                      <span style={{ color: "var(--muted)" }}>{gap.language} {gap.variant.toUpperCase()} {gap.level.toUpperCase()}</span>
                      <span style={{ color: "var(--foreground)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{gap.journeyTopic}</span>
                    </div>
                  );
                })}
              </div>
            </Collapsible>
          )}

          {/* proposals */}
          {agentRun.output.proposals && agentRun.output.proposals.length > 0 && (
            <Collapsible title={`Propuestas (${agentRun.output.proposals.length})`} defaultOpen>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {agentRun.output.proposals.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px", borderRadius: 4, fontSize: 11, borderLeft: "2px solid var(--studio-accent, #14b8a6)" }}>
                    <span style={statusPill("rgba(20,184,166,0.12)", "var(--studio-accent, #14b8a6)")}>Propuesta</span>
                    <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{p.topicLabel}</span>
                    <span style={{ color: "var(--muted)" }}>{p.language} {p.variant.toUpperCase()}</span>
                    <span style={{ color: "var(--muted)", marginLeft: "auto" }}>{p.levels.join(",").toUpperCase()} x{p.storiesPerLevel}</span>
                  </div>
                ))}
              </div>
            </Collapsible>
          )}
        </div>
      )}

      {/* ── briefs (grouped by level) ─────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={sectionHead}>Historias pendientes</span>
          <span style={{ ...mutedTxt, fontSize: 10 }}>{filteredBriefs.length} total</span>

          <div style={{ display: "flex", gap: 3, marginLeft: "auto", alignItems: "center", flexWrap: "wrap" }}>
            {/* idioma */}
            <span style={{ fontSize: 9, color: "var(--muted)", marginRight: 1 }}>Idioma:</span>
            <button onClick={() => setBriefLanguageFilter("all")} style={pill(briefLanguageFilter === "all")}>Todos</button>
            {uniqueLanguages.map((l) => (
              <button key={l} onClick={() => setBriefLanguageFilter(l)} style={pill(briefLanguageFilter === l)}>{l.toUpperCase()}</button>
            ))}
            <span style={{ width: 1, height: 12, backgroundColor: "var(--card-border)", margin: "0 3px" }} />
            {/* estado */}
            <span style={{ fontSize: 9, color: "var(--muted)", marginRight: 1 }}>Estado:</span>
            <button onClick={() => setBriefStatusFilter("all")} style={pill(briefStatusFilter === "all")}>Todos</button>
            {uniqueStatuses.map((s) => (
              <button key={s} onClick={() => setBriefStatusFilter(s)} style={pill(briefStatusFilter === s)}>{s}</button>
            ))}
            <span style={{ width: 1, height: 12, backgroundColor: "var(--card-border)", margin: "0 3px" }} />
            {/* nivel */}
            <span style={{ fontSize: 9, color: "var(--muted)", marginRight: 1 }}>Nivel:</span>
            <button onClick={() => setBriefLevelFilter("all")} style={pill(briefLevelFilter === "all")}>Todos</button>
            {uniqueLevels.map((l) => (
              <button key={l} onClick={() => setBriefLevelFilter(l)} style={pill(briefLevelFilter === l)}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {briefError && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>{briefError}</p>}

        {brieferLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[1, 2, 3].map((i) => <div key={i} className="studio-skeleton" style={{ height: 28 }} />)}
          </div>
        ) : filteredBriefs.length === 0 ? (
          <p style={{ ...mutedTxt, textAlign: "center", padding: "16px 0" }}>No hay briefs con estos filtros. Ejecuta un analisis.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {sortedLevelKeys.map((lvl) => (
              <BriefLevelGroup key={lvl} level={lvl} briefs={briefsByLevel[lvl]} router={router} />
            ))}
          </div>
        )}
      </div>

      {/* ── execution history (collapsible) ───────────── */}
      <Collapsible
        title="Historial"
        badge={<span style={{ ...mutedTxt, fontSize: 10 }}>{runHistory.length} runs</span>}
      >
        {historyError && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>{historyError}</p>}
        {historyLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[1, 2].map((i) => <div key={i} className="studio-skeleton" style={{ height: 24 }} />)}
          </div>
        ) : runHistory.length === 0 ? (
          <p style={mutedTxt}>Sin historial aun.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {runHistory.map((run) => {
              const d = run.startedAt ? new Date(run.startedAt).toLocaleDateString("es", { day: "numeric", month: "short" }) : run.createdAt ? new Date(run.createdAt).toLocaleDateString("es", { day: "numeric", month: "short" }) : "—";
              const out = (run.output ?? {}) as Record<string, unknown>;
              return (
                <div key={run.runId ?? run.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 6px", borderRadius: 4, fontSize: 11 }}>
                  <span style={statusPill("rgba(125,211,160,0.15)", "#7dd3a0")}>{run.status}</span>
                  <span style={{ color: "var(--muted)" }}>{d}</span>
                  {out.totalStoriesAnalyzed != null && <span style={{ color: "var(--muted)" }}>Analizadas: <strong style={{ color: "var(--foreground)" }}>{String(out.totalStoriesAnalyzed)}</strong></span>}
                  {out.gapsFound != null && <span style={{ color: "var(--muted)" }}>Faltantes: <strong style={{ color: "var(--foreground)" }}>{String(out.gapsFound)}</strong></span>}
                  {out.briefsCreated != null && <span style={{ color: "var(--muted)" }}>Pendientes: <strong style={{ color: "var(--foreground)" }}>{String(out.briefsCreated)}</strong></span>}
                  {out.journeysProposed != null && <span style={{ color: "var(--muted)" }}>Propuestos: <strong style={{ color: "var(--foreground)" }}>{String(out.journeysProposed)}</strong></span>}
                  {out.journeysCreated != null && <span style={{ color: "var(--muted)" }}>Creados: <strong style={{ color: "var(--foreground)" }}>{String(out.journeysCreated)}</strong></span>}
                </div>
              );
            })}
          </div>
        )}
      </Collapsible>

      {/* ── runtime config (collapsible) ──────────────── */}
      <Collapsible title="Configuración avanzada" badge={
        plannerConfigDraft ? <span style={{ ...mutedTxt, fontSize: 10 }}>{plannerConfigSource === "database" ? "Personalizada" : "Default"}</span> : undefined
      }>
        {plannerConfigLoading && <p style={mutedTxt}>Cargando...</p>}
        {plannerConfigError && <p style={{ margin: 0, fontSize: 11, color: "#ef4444" }}>{plannerConfigError}</p>}

        {plannerConfigDraft && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={tinyLabel}>Scope default</span>
                <select value={plannerConfigDraft.defaultGapScope} onChange={(e) => updatePlannerConfig("defaultGapScope", e.target.value as PlannerScope)} disabled={!plannerConfigCanEdit} style={inp}>
                  <option value="full">Full</option><option value="language">Language</option><option value="journey">Journey</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={tinyLabel}>Idioma default</span>
                <input type="text" value={plannerConfigDraft.defaultGapLanguage} onChange={(e) => updatePlannerConfig("defaultGapLanguage", e.target.value.trim().toLowerCase())} disabled={!plannerConfigCanEdit} style={inp} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={tinyLabel}>Historias/tema</span>
                <input type="number" min={1} value={plannerConfigDraft.defaultStoriesPerLevel} onChange={(e) => updatePlannerConfig("defaultStoriesPerLevel", Math.max(1, parseInt(e.target.value, 10) || 1))} disabled={!plannerConfigCanEdit} style={inp} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={tinyLabel}>Historias/slot</span>
                <input type="number" min={1} value={plannerConfigDraft.expectedSlotsPerTopic} onChange={(e) => updatePlannerConfig("expectedSlotsPerTopic", Math.max(1, parseInt(e.target.value, 10) || 1))} disabled={!plannerConfigCanEdit} style={inp} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={tinyLabel}>Max gaps visibles</span>
                <input type="number" min={1} value={plannerConfigDraft.maxVisibleGaps} onChange={(e) => updatePlannerConfig("maxVisibleGaps", Math.max(1, parseInt(e.target.value, 10) || 1))} disabled={!plannerConfigCanEdit} style={inp} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
              {([
                ["availableLanguages", "Idiomas disponibles"],
                ["availableLevels", "Niveles disponibles"],
                ["defaultTargetLanguages", "Target idiomas"],
                ["defaultTargetLevels", "Target niveles"],
              ] as const).map(([field, label]) => (
                <label key={field} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={tinyLabel}>{label}</span>
                  <input
                    type="text"
                    value={(plannerConfigDraft[field] as string[]).join(", ")}
                    onChange={(e) => updatePlannerConfigList(field, e.target.value)}
                    disabled={!plannerConfigCanEdit}
                    style={inp}
                  />
                </label>
              ))}
            </div>

            {plannerConfigMessage && (
              <p style={{ margin: 0, fontSize: 11, color: plannerConfigMessage.type === "ok" ? "#7dd3a0" : "#ef4444" }}>{plannerConfigMessage.text}</p>
            )}

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => void savePlannerConfig()} disabled={!plannerConfigCanEdit || !plannerConfigDirty || plannerConfigSaving} style={btnPrimary(!plannerConfigCanEdit || !plannerConfigDirty || plannerConfigSaving)}>
                {plannerConfigSaving ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => void resetPlannerConfig()} disabled={!plannerConfigCanEdit || plannerConfigSaving || plannerConfigSource === "defaults"} style={{ ...btnGhost, opacity: (!plannerConfigCanEdit || plannerConfigSaving || plannerConfigSource === "defaults") ? 0.5 : 1 }}>
                Restaurar defaults
              </button>
              {!plannerConfigCanEdit && <span style={{ ...mutedTxt, fontSize: 10 }}>Solo admins pueden editar.</span>}
              {plannerConfigUpdatedBy && (
                <span style={{ ...mutedTxt, fontSize: 10, marginLeft: "auto" }}>
                  Editado por {plannerConfigUpdatedBy}{plannerConfigUpdatedAt ? ` el ${new Date(plannerConfigUpdatedAt).toLocaleDateString("es")}` : ""}
                </span>
              )}
            </div>
          </>
        )}
      </Collapsible>
    </div>
  );
}
