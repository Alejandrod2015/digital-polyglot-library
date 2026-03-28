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
  runId: string;
  agent: string;
  status: string;
  startedAt: string;
  completedAt: string;
  output: {
    totalStoriesAnalyzed?: number;
    gapsFound?: number;
    briefsCreated?: number;
    journeysProposed?: number;
    journeysCreated?: number;
  };
};

const cardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 12,
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const inputStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 10,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  padding: "0 12px",
  fontSize: 14,
};

const textareaStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid var(--card-border)",
  backgroundColor: "var(--background)",
  color: "var(--foreground)",
  padding: "10px 12px",
  fontSize: 14,
  minHeight: 84,
  resize: "vertical",
};

const compactSectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  color: "var(--foreground)",
};

function ModeButton({
  mode,
  selected,
  label,
  onClick,
}: {
  mode: PlannerMode;
  selected: PlannerMode;
  label: string;
  onClick: () => void;
}) {
  const isSelected = mode === selected;
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "14px 18px",
        borderRadius: 10,
        border: `2px solid ${isSelected ? "var(--studio-accent, #14b8a6)" : "var(--card-border)"}`,
        backgroundColor: isSelected ? "var(--studio-accent-soft, rgba(20,184,166,0.15))" : "transparent",
        color: isSelected ? "var(--studio-accent, #14b8a6)" : "var(--foreground)",
        fontSize: 15,
        fontWeight: isSelected ? 700 : 600,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function ScopeButton({
  scope,
  selected,
  label,
  onClick,
}: {
  scope: PlannerScope;
  selected: PlannerScope;
  label: string;
  onClick: () => void;
}) {
  const isSelected = scope === selected;
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "12px 16px",
        borderRadius: 10,
        border: `1px solid ${isSelected ? "var(--studio-accent, #14b8a6)" : "var(--card-border)"}`,
        backgroundColor: isSelected ? "var(--studio-accent-soft, rgba(20,184,166,0.15))" : "transparent",
        color: isSelected ? "var(--studio-accent, #14b8a6)" : "var(--foreground)",
        fontSize: 14,
        fontWeight: isSelected ? 600 : 500,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
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
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--muted)",
          margin: "4px 0 0",
        }}
      >
        {label}
      </p>
    </div>
  );
}

function GapCard({ gap }: { gap: PlannerGap }) {
  const isIncomplete = gap.reason === "incomplete";
  const bgColor = isIncomplete ? "rgba(245, 158, 11, 0.08)" : "rgba(239, 68, 68, 0.08)";
  const borderColor = isIncomplete ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)";
  const dotColor = isIncomplete ? "#f59e0b" : "#ef4444";

  return (
    <div
      style={{
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${dotColor}`,
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "3px 8px",
            borderRadius: 6,
            backgroundColor: bgColor,
            color: dotColor,
            border: `1px solid ${borderColor}`,
            whiteSpace: "nowrap",
          }}
        >
          {gap.reason === "missing" ? "Falta" : "Incompleto"}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
          Slot {gap.storySlot}
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          {gap.language} · {gap.variant.toUpperCase()} · {gap.level.toUpperCase()}
        </span>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
          {gap.journeyTopic}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
          Enfoque: {gap.journeyFocus}
        </p>
      </div>
    </div>
  );
}

function ProposalCard({ proposal }: { proposal: PlannerProposal }) {
  return (
    <div
      style={{
        backgroundColor: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: 10,
        padding: "14px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "3px 8px",
            borderRadius: 6,
            backgroundColor: "rgba(20, 184, 166, 0.15)",
            color: "var(--studio-accent, #14b8a6)",
            border: "1px solid var(--studio-accent, #14b8a6)",
            whiteSpace: "nowrap",
          }}
        >
          Propuesta
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)" }}>
          {proposal.language} · {proposal.variant.toUpperCase()}
        </span>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
          {proposal.topicLabel}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
          Slug: {proposal.topicSlug}
        </p>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        <p style={{ margin: "6px 0 0" }}>
          Niveles: <strong style={{ color: "var(--foreground)" }}>{proposal.levels.join(", ").toUpperCase()}</strong>
        </p>
        <p style={{ margin: "4px 0 0" }}>
          Historias por nivel: <strong style={{ color: "var(--foreground)" }}>{proposal.storiesPerLevel}</strong>
        </p>
      </div>
    </div>
  );
}

function BriefCard({ brief }: { brief: PlannerBrief }) {
  const router = useRouter();
  return (
    <div
      style={{
        backgroundColor: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: 10,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
          {brief.title}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>
          {brief.language} · {brief.level.toUpperCase()} · Slot {brief.storySlot}
        </p>
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          padding: "4px 10px",
          borderRadius: 6,
          backgroundColor: "rgba(20, 184, 166, 0.15)",
          color: "var(--studio-accent, #14b8a6)",
          border: "1px solid var(--studio-accent, #14b8a6)",
          whiteSpace: "nowrap",
        }}
      >
        {brief.status}
      </span>
      <button
        onClick={() => router.push("/studio/journey-stories")}
        style={{
          padding: "6px 12px",
          borderRadius: 8,
          border: "1px solid var(--card-border)",
          backgroundColor: "transparent",
          color: "var(--foreground)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--studio-accent-soft, rgba(20,184,166,0.15))";
          e.currentTarget.style.borderColor = "var(--studio-accent, #14b8a6)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.borderColor = "var(--card-border)";
        }}
      >
        Generar historia
      </button>
    </div>
  );
}

function RunHistoryCard({ run }: { run: AgentRun }) {
  const date = new Date(run.startedAt).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      style={{
        backgroundColor: "var(--card-bg)",
        border: "1px solid var(--card-border)",
        borderRadius: 10,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "3px 8px",
              borderRadius: 6,
              backgroundColor: "rgba(125, 211, 160, 0.15)",
              color: "#7dd3a0",
              border: "1px solid rgba(125, 211, 160, 0.3)",
              whiteSpace: "nowrap",
            }}
          >
            {run.status}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{date}</span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, flexWrap: "wrap" }}>
          {run.output.totalStoriesAnalyzed !== undefined && (
            <span style={{ color: "var(--muted)" }}>
              Historias analizadas: <strong style={{ color: "var(--foreground)" }}>{run.output.totalStoriesAnalyzed}</strong>
            </span>
          )}
          {run.output.gapsFound !== undefined && (
            <span style={{ color: "var(--muted)" }}>
              Gaps: <strong style={{ color: "var(--foreground)" }}>{run.output.gapsFound}</strong>
            </span>
          )}
          {run.output.briefsCreated !== undefined && (
            <span style={{ color: "var(--muted)" }}>
              Briefs: <strong style={{ color: "var(--foreground)" }}>{run.output.briefsCreated}</strong>
            </span>
          )}
          {run.output.journeysProposed !== undefined && (
            <span style={{ color: "var(--muted)" }}>
              Journeys propuestos: <strong style={{ color: "var(--foreground)" }}>{run.output.journeysProposed}</strong>
            </span>
          )}
          {run.output.journeysCreated !== undefined && (
            <span style={{ color: "var(--muted)" }}>
              Journeys creados: <strong style={{ color: "var(--foreground)" }}>{run.output.journeysCreated}</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CompactInfoCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        backgroundColor: "rgba(255,255,255,0.02)",
        border: "1px solid var(--card-border)",
      }}
    >
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--foreground)" }}>{title}</p>
      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{body}</p>
    </div>
  );
}

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

  // Gap detection mode state
  const [scope, setScope] = useState<PlannerScope>("full");
  const [language, setLanguage] = useState("es");
  const [variant, setVariant] = useState("");
  const [journeyTopic, setJourneyTopic] = useState("");

  // Create journey mode state
  const [topicSlug, setTopicSlug] = useState("");
  const [topicLabel, setTopicLabel] = useState("");
  const [targetLanguages, setTargetLanguages] = useState<Set<string>>(new Set(["es"]));
  const [targetLevels, setTargetLevels] = useState<Set<string>>(new Set(["a1", "a2", "b1", "b2"]));
  const [storiesPerLevel, setStoriesPerLevel] = useState(4);

  // Common state
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

  const loadPlannerConfig = useCallback(async () => {
    setPlannerConfigLoading(true);
    setPlannerConfigError(null);
    try {
      const res = await fetch("/api/studio/planner/config");
      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/planner");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
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
    } finally {
      setPlannerConfigLoading(false);
    }
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
      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/planner");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { briefs: PlannerBrief[] };
      setBriefs(data.briefs);
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : "No se pudieron cargar los briefs.");
    } finally {
      setBrieferLoading(false);
    }
  }, [briefLanguageFilter, briefLevelFilter, briefStatusFilter, router]);

  const loadRunHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/runs?kind=planner&limit=10");
      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/planner");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { runs: AgentRun[] };
      setRunHistory(data.runs);
      setHistoryError(null);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "No se pudo cargar el historial de ejecuciones.");
    } finally {
      setHistoryLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadPlannerConfig();
    void loadRunHistory();
    void loadBriefs();
  }, [loadBriefs, loadPlannerConfig, loadRunHistory]);

  useEffect(() => {
    void loadBriefs();
  }, [loadBriefs]);

  const updatePlannerConfig = <K extends keyof PlannerConfig>(field: K, value: PlannerConfig[K]) => {
    setPlannerConfigDraft((current) => {
      if (!current) return current;
      return { ...current, [field]: value };
    });
    setPlannerConfigDirty(true);
  };

  const updatePlannerConfigList = (field: "availableLanguages" | "availableLevels" | "defaultTargetLanguages" | "defaultTargetLevels", value: string) => {
    const items = value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    updatePlannerConfig(field, Array.from(new Set(items)) as PlannerConfig[typeof field]);
  };

  const savePlannerConfig = async () => {
    if (!plannerConfigDraft || !plannerConfigCanEdit) return;
    setPlannerConfigSaving(true);
    setPlannerConfigMessage(null);
    try {
      const res = await fetch("/api/studio/planner/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: plannerConfigDraft }),
      });
      const data = (await res.json().catch(() => null)) as Partial<PlannerConfigResponse> & { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      if (data?.config) {
        setPlannerConfig(data.config);
        setPlannerConfigDraft(data.config);
        setPlannerConfigSource("database");
        setPlannerConfigUpdatedBy(data.updatedBy ?? null);
        setPlannerConfigUpdatedAt(data.updatedAt ?? null);
        setPlannerConfigDirty(false);
        setScope(data.config.defaultGapScope);
        setLanguage(data.config.defaultGapLanguage);
        setTargetLanguages(new Set(data.config.defaultTargetLanguages));
        setTargetLevels(new Set(data.config.defaultTargetLevels));
        setStoriesPerLevel(data.config.defaultStoriesPerLevel);
      }
      setPlannerConfigMessage({ type: "ok", text: "Configuración del planner guardada." });
    } catch (err) {
      setPlannerConfigMessage({
        type: "error",
        text: err instanceof Error ? err.message : "No se pudo guardar la configuración del planner.",
      });
    } finally {
      setPlannerConfigSaving(false);
    }
  };

  const resetPlannerConfig = async () => {
    if (!plannerConfigCanEdit) return;
    setPlannerConfigSaving(true);
    setPlannerConfigMessage(null);
    try {
      const res = await fetch("/api/studio/planner/config", { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as Partial<PlannerConfigResponse> & { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      await loadPlannerConfig();
      setPlannerConfigMessage({ type: "ok", text: "Configuración restaurada a valores por defecto." });
    } catch (err) {
      setPlannerConfigMessage({
        type: "error",
        text: err instanceof Error ? err.message : "No se pudo restaurar la configuración del planner.",
      });
    } finally {
      setPlannerConfigSaving(false);
    }
  };

  async function runPlannerAgent() {
    setAgentError(null);
    setAgentRunning(true);

    try {
      let body: Record<string, unknown> = {};

      if (mode === "gaps") {
        body = { mode: "gaps", scope };
        if (scope === "language") {
          body.language = language;
          body.variant = variant;
        } else if (scope === "journey") {
          body.journeyTopic = journeyTopic;
        }
      } else if (mode === "create-journey") {
        body = {
          mode: "create-journey",
          newJourneyTopic: topicSlug,
          newJourneyTopicLabel: topicLabel,
          targetLanguages: Array.from(targetLanguages),
          targetLevels: Array.from(targetLevels),
          storiesPerLevel,
        };
      }

      const res = await fetch("/api/agents/planner/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/studio/planner");
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as PlannerAgentRun;
      setAgentRun(data);
      setHistoryLoading(true);
      await loadRunHistory();
      await loadBriefs();
    } catch (err) {
      setAgentError(err instanceof Error ? err.message : "No se pudo ejecutar el Planner Agent.");
    } finally {
      setAgentRunning(false);
    }
  }

  const uniqueLanguages = Array.from(new Set(briefs.map((b) => b.language)));
  const uniqueLevels = Array.from(new Set(briefs.map((b) => b.level)));
  const uniqueStatuses = Array.from(new Set(briefs.map((b) => b.status)));

  const filteredBriefs = briefs.filter((brief) => {
    if (briefLanguageFilter !== "all" && brief.language !== briefLanguageFilter) return false;
    if (briefLevelFilter !== "all" && brief.level !== briefLevelFilter) return false;
    if (briefStatusFilter !== "all" && brief.status !== briefStatusFilter) return false;
    return true;
  });

  const toggleLanguage = (lang: string) => {
    const newSet = new Set(targetLanguages);
    if (newSet.has(lang)) {
      newSet.delete(lang);
    } else {
      newSet.add(lang);
    }
    setTargetLanguages(newSet);
  };

  const toggleLevel = (level: string) => {
    const newSet = new Set(targetLevels);
    if (newSet.has(level)) {
      newSet.delete(level);
    } else {
      newSet.add(level);
    }
    setTargetLevels(newSet);
  };

  const plannerStopSummary =
    mode === "gaps"
      ? "Se detiene cuando termina de cargar el catálogo, detectar gaps y guardar los briefs nuevos. No lanza Content ni QA."
      : "Se detiene cuando propone journeys, los crea, vuelve a detectar gaps para ese topic y guarda los briefs. No genera historias todavía.";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={cardStyle}>
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--studio-accent, #14b8a6)",
            }}
          >
            Configuración runtime
          </p>
          <h3 style={{ margin: "8px 0 6px", fontSize: 22, color: "var(--foreground)" }}>
            Parámetros actuales del planner
          </h3>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", maxWidth: 880, lineHeight: 1.6 }}>
            Aquí se define cómo y cuánto planifica el agente: alcance por defecto, idiomas y niveles disponibles, historias por nivel, slots esperados por topic y cuántos gaps se muestran en el resultado.
          </p>
        </div>

        {plannerConfigLoading && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Cargando configuración del planner...</p>
        )}

        {plannerConfigError && (
          <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>{plannerConfigError}</p>
        )}

        {plannerConfigDraft && (
          <>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                padding: 10,
                borderRadius: 10,
                backgroundColor: "rgba(255,255,255,0.02)",
                border: "1px solid var(--card-border)",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Fuente: <strong style={{ color: "var(--foreground)" }}>{plannerConfigSource === "database" ? "Personalizada" : "Default"}</strong>
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Slots por topic: <strong style={{ color: "var(--foreground)" }}>{plannerConfigDraft.expectedSlotsPerTopic}</strong>
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Gaps visibles: <strong style={{ color: "var(--foreground)" }}>{plannerConfigDraft.maxVisibleGaps}</strong>
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Historias por nivel: <strong style={{ color: "var(--foreground)" }}>{plannerConfigDraft.defaultStoriesPerLevel}</strong>
              </span>
              {plannerConfigUpdatedBy && (
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Última edición: <strong style={{ color: "var(--foreground)" }}>{plannerConfigUpdatedBy}</strong>
                  {plannerConfigUpdatedAt ? ` · ${new Date(plannerConfigUpdatedAt).toLocaleDateString("es")}` : ""}
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, alignItems: "start" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Scope por defecto</span>
                <select
                  value={plannerConfigDraft.defaultGapScope}
                  onChange={(e) => updatePlannerConfig("defaultGapScope", e.target.value as PlannerScope)}
                  disabled={!plannerConfigCanEdit}
                  style={inputStyle}
                >
                  <option value="full">Full</option>
                  <option value="language">Language</option>
                  <option value="journey">Journey</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Idioma por defecto</span>
                <input
                  type="text"
                  value={plannerConfigDraft.defaultGapLanguage}
                  onChange={(e) => updatePlannerConfig("defaultGapLanguage", e.target.value.trim().toLowerCase())}
                  disabled={!plannerConfigCanEdit}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Historias por nivel</span>
                <input
                  type="number"
                  min="1"
                  value={plannerConfigDraft.defaultStoriesPerLevel}
                  onChange={(e) => updatePlannerConfig("defaultStoriesPerLevel", Math.max(1, parseInt(e.target.value, 10) || 1))}
                  disabled={!plannerConfigCanEdit}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Slots esperados por topic</span>
                <input
                  type="number"
                  min="1"
                  value={plannerConfigDraft.expectedSlotsPerTopic}
                  onChange={(e) => updatePlannerConfig("expectedSlotsPerTopic", Math.max(1, parseInt(e.target.value, 10) || 1))}
                  disabled={!plannerConfigCanEdit}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Máximo de gaps visibles</span>
                <input
                  type="number"
                  min="1"
                  value={plannerConfigDraft.maxVisibleGaps}
                  onChange={(e) => updatePlannerConfig("maxVisibleGaps", Math.max(1, parseInt(e.target.value, 10) || 1))}
                  disabled={!plannerConfigCanEdit}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Idiomas disponibles</span>
                <textarea
                  value={plannerConfigDraft.availableLanguages.join(", ")}
                  onChange={(e) => updatePlannerConfigList("availableLanguages", e.target.value)}
                  disabled={!plannerConfigCanEdit}
                  style={{ ...textareaStyle, minHeight: 56 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Niveles disponibles</span>
                <textarea
                  value={plannerConfigDraft.availableLevels.join(", ")}
                  onChange={(e) => updatePlannerConfigList("availableLevels", e.target.value)}
                  disabled={!plannerConfigCanEdit}
                  style={{ ...textareaStyle, minHeight: 56 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Idiomas target por defecto</span>
                <textarea
                  value={plannerConfigDraft.defaultTargetLanguages.join(", ")}
                  onChange={(e) => updatePlannerConfigList("defaultTargetLanguages", e.target.value)}
                  disabled={!plannerConfigCanEdit}
                  style={{ ...textareaStyle, minHeight: 56 }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Niveles target por defecto</span>
                <textarea
                  value={plannerConfigDraft.defaultTargetLevels.join(", ")}
                  onChange={(e) => updatePlannerConfigList("defaultTargetLevels", e.target.value)}
                  disabled={!plannerConfigCanEdit}
                  style={{ ...textareaStyle, minHeight: 56 }}
                />
              </label>
            </div>

            {plannerConfigDefaults && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                Defaults del sistema: scope <strong style={{ color: "var(--foreground)" }}>{plannerConfigDefaults.defaultGapScope}</strong>,
                idioma <strong style={{ color: "var(--foreground)" }}>{plannerConfigDefaults.defaultGapLanguage.toUpperCase()}</strong>,
                historias por nivel <strong style={{ color: "var(--foreground)" }}>{plannerConfigDefaults.defaultStoriesPerLevel}</strong>,
                slots por topic <strong style={{ color: "var(--foreground)" }}>{plannerConfigDefaults.expectedSlotsPerTopic}</strong>,
                gaps visibles <strong style={{ color: "var(--foreground)" }}>{plannerConfigDefaults.maxVisibleGaps}</strong>.
              </p>
            )}

            {plannerConfigMessage && (
              <p style={{ margin: 0, fontSize: 13, color: plannerConfigMessage.type === "ok" ? "#7dd3a0" : "#ef4444" }}>
                {plannerConfigMessage.text}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => void savePlannerConfig()}
                  disabled={!plannerConfigCanEdit || !plannerConfigDirty || plannerConfigSaving}
                  style={{
                    height: 36,
                    borderRadius: 10,
                    border: "none",
                    backgroundColor: "var(--primary)",
                    color: "#fff",
                    fontWeight: 700,
                    padding: "0 14px",
                    cursor: plannerConfigSaving ? "progress" : "pointer",
                    opacity: !plannerConfigCanEdit || !plannerConfigDirty || plannerConfigSaving ? 0.6 : 1,
                  }}
                >
                  {plannerConfigSaving ? "Guardando..." : "Guardar configuración"}
                </button>
                <button
                  onClick={() => void resetPlannerConfig()}
                  disabled={!plannerConfigCanEdit || plannerConfigSaving || plannerConfigSource === "defaults"}
                  style={{
                    height: 36,
                    borderRadius: 10,
                    border: "1px solid var(--card-border)",
                    backgroundColor: "transparent",
                    color: "var(--foreground)",
                    fontWeight: 600,
                    padding: "0 14px",
                    cursor: plannerConfigSaving ? "progress" : "pointer",
                    opacity: !plannerConfigCanEdit || plannerConfigSaving || plannerConfigSource === "defaults" ? 0.6 : 1,
                  }}
                >
                  Restaurar defaults
                </button>
              </div>
              {!plannerConfigCanEdit && (
                <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
                  Solo admins pueden editar esta configuración.
                </span>
              )}
            </div>
          </>
        )}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(280px, 1fr))", gap: 12 }}>
        <CompactInfoCard
          title="Qué pasa al ejecutar"
          body={mode === "gaps" ? "Analiza catálogo, detecta huecos y crea briefs nuevos para los faltantes." : "Crea el journey, vuelve a detectar huecos de ese topic y deja briefs listos para Content Agent."}
        />
        <CompactInfoCard
          title="Cuándo para"
          body={plannerStopSummary}
        />
      </div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 12 }}>
        <ModeButton
          mode="gaps"
          selected={mode}
          label="Detectar gaps"
          onClick={() => setMode("gaps")}
        />
        <ModeButton
          mode="create-journey"
          selected={mode}
          label="Crear journey"
          onClick={() => setMode("create-journey")}
        />
      </div>

      {/* Section 1: Gap Detection Mode */}
      {mode === "gaps" && (
        <section style={cardStyle}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              color: "var(--studio-accent, #14b8a6)",
            }}
          >
            Detección de gaps
          </p>
            <h3 style={{ ...compactSectionTitle, marginTop: 6 }}>
              Detectar gaps en el catálogo
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)", maxWidth: 840, lineHeight: 1.5 }}>
              Analiza el catálogo, detecta huecos y crea briefs para las historias faltantes.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr minmax(220px, 0.9fr) minmax(220px, 0.9fr)",
              gap: 10,
              alignItems: "end",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Alcance</span>
              <div style={{ display: "flex", gap: 8 }}>
                <ScopeButton
                  scope="full"
                  selected={scope}
                  label="Completo"
                  onClick={() => setScope("full")}
                />
                <ScopeButton
                  scope="language"
                  selected={scope}
                  label="Idioma"
                  onClick={() => setScope("language")}
                />
                <ScopeButton
                  scope="journey"
                  selected={scope}
                  label="Journey"
                  onClick={() => setScope("journey")}
                />
              </div>
            </div>

            {scope === "language" ? (
              <>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Idioma</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} style={inputStyle}>
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Variante</span>
                  <input
                    type="text"
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    placeholder="Opcional"
                    style={inputStyle}
                  />
                </label>
              </>
            ) : scope === "journey" ? (
              <>
                <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "span 2" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Journey topic</span>
                  <input
                    type="text"
                    value={journeyTopic}
                    onChange={(e) => setJourneyTopic(e.target.value)}
                    placeholder="ej: coffee, travel, business"
                    style={inputStyle}
                  />
                </label>
              </>
            ) : (
              <>
                <div
                  style={{
                    height: 42,
                    borderRadius: 10,
                    border: "1px dashed var(--card-border)",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 12px",
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  Recorre todo el catálogo.
                </div>
                <div
                  style={{
                    height: 42,
                    borderRadius: 10,
                    border: "1px dashed var(--card-border)",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 12px",
                    fontSize: 12,
                    color: "var(--muted)",
                  }}
                >
                  Sin filtros extra.
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              Termina al guardar briefs nuevos. No ejecuta Content ni QA.
            </span>
            <button
              onClick={() => void runPlannerAgent()}
              disabled={agentRunning || (scope === "journey" && !journeyTopic)}
              style={{
                height: 38,
                borderRadius: 10,
                border: "none",
                backgroundColor: "var(--primary)",
                color: "#fff",
                fontWeight: 700,
                padding: "0 16px",
                cursor: agentRunning ? "progress" : "pointer",
                opacity: agentRunning || (scope === "journey" && !journeyTopic) ? 0.7 : 1,
              }}
            >
              {agentRunning ? "Ejecutando..." : "Ejecutar planner"}
            </button>
          </div>

          {agentError && (
            <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>
              {agentError}
            </p>
          )}

          {/* Agent run result */}
          {agentRun && (
            <div
              style={{
                padding: 18,
                borderRadius: 12,
                border: "1px solid var(--card-border)",
                backgroundColor: "rgba(255,255,255,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "3px 8px",
                    borderRadius: 6,
                    backgroundColor: "rgba(125, 211, 160, 0.15)",
                    color: "#7dd3a0",
                    border: "1px solid rgba(125, 211, 160, 0.3)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {agentRun.output.status}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
                  Análisis completado
                </span>
              </div>

              <p style={{ margin: 0, fontSize: 14, color: "var(--foreground)", lineHeight: 1.6 }}>
                {agentRun.output.summary}
              </p>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {agentRun.output.totalStoriesAnalyzed !== undefined && (
                  <StatCard
                    label="Historias analizadas"
                    value={agentRun.output.totalStoriesAnalyzed}
                    color="var(--foreground)"
                  />
                )}
                {agentRun.output.gapsFound !== undefined && (
                  <StatCard label="Gaps detectados" value={agentRun.output.gapsFound} color="#ef4444" />
                )}
                {agentRun.output.briefsCreated !== undefined && (
                  <StatCard label="Briefs creados" value={agentRun.output.briefsCreated} color="#7dd3a0" />
                )}
              </div>

              {/* Gaps display */}
              {agentRun.output.gaps && agentRun.output.gaps.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                      Gaps detectados (primeros {plannerConfig?.maxVisibleGaps ?? 50})
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {agentRun.output.gaps.map((gap, i) => (
                        <GapCard key={i} gap={gap} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Section 2: Create Journey Mode */}
      {mode === "create-journey" && (
        <section style={cardStyle}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              color: "var(--studio-accent, #14b8a6)",
            }}
          >
            Creación de journeys
          </p>
            <h3 style={{ ...compactSectionTitle, marginTop: 6 }}>
              Crear nuevo journey
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)", maxWidth: 840, lineHeight: 1.5 }}>
              Crea el journey y deja briefs listos para el siguiente paso del pipeline.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.7fr", gap: 10, alignItems: "end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Topic Slug *</span>
              <input
                type="text"
                value={topicSlug}
                onChange={(e) => setTopicSlug(e.target.value)}
                placeholder="ej: coffee, travel"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Topic Label *</span>
              <input
                type="text"
                value={topicLabel}
                onChange={(e) => setTopicLabel(e.target.value)}
                placeholder="ej: Coffee Culture"
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Stories / nivel</span>
              <input
                type="number"
                min="1"
                value={storiesPerLevel}
                onChange={(e) => setStoriesPerLevel(Math.max(1, parseInt(e.target.value) || 1))}
                style={inputStyle}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Target languages *</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {LANGUAGES.map((lang) => (
                  <label key={lang} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "var(--foreground)" }}>
                    <input
                      type="checkbox"
                      checked={targetLanguages.has(lang)}
                      onChange={() => toggleLanguage(lang)}
                      style={{ cursor: "pointer" }}
                    />
                    <span>{lang.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Target levels *</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {LEVELS.map((level) => (
                  <label key={level} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "var(--foreground)" }}>
                    <input
                      type="checkbox"
                      checked={targetLevels.has(level)}
                      onChange={() => toggleLevel(level)}
                      style={{ cursor: "pointer" }}
                    />
                    <span>{level.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              Termina al crear el journey y guardar los briefs derivados. No genera historias todavía.
            </span>
            <button
              onClick={() => void runPlannerAgent()}
              disabled={agentRunning || !topicSlug || !topicLabel || targetLanguages.size === 0 || targetLevels.size === 0}
              style={{
                height: 38,
                borderRadius: 10,
                border: "none",
                backgroundColor: "var(--primary)",
                color: "#fff",
                fontWeight: 700,
                padding: "0 16px",
                cursor: agentRunning ? "progress" : "pointer",
                opacity: agentRunning || !topicSlug || !topicLabel || targetLanguages.size === 0 || targetLevels.size === 0 ? 0.7 : 1,
              }}
            >
              {agentRunning ? "Creando..." : "Crear journey"}
            </button>
          </div>

          {agentError && (
            <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>
              {agentError}
            </p>
          )}

          {/* Agent run result */}
          {agentRun && (
            <div
              style={{
                padding: 18,
                borderRadius: 12,
                border: "1px solid var(--card-border)",
                backgroundColor: "rgba(255,255,255,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    padding: "3px 8px",
                    borderRadius: 6,
                    backgroundColor: "rgba(125, 211, 160, 0.15)",
                    color: "#7dd3a0",
                    border: "1px solid rgba(125, 211, 160, 0.3)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {agentRun.output.status}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>
                  Journey creado
                </span>
              </div>

              <p style={{ margin: 0, fontSize: 14, color: "var(--foreground)", lineHeight: 1.6 }}>
                {agentRun.output.summary}
              </p>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {agentRun.output.journeysProposed !== undefined && (
                  <StatCard label="Journeys propuestos" value={agentRun.output.journeysProposed} color="var(--foreground)" />
                )}
                {agentRun.output.journeysCreated !== undefined && (
                  <StatCard label="Journeys creados" value={agentRun.output.journeysCreated} color="#7dd3a0" />
                )}
                {(agentRun.output.gapsFound ?? 0) > 0 && (
                  <StatCard label="Gaps detectados" value={agentRun.output.gapsFound!} color="#ef4444" />
                )}
                {(agentRun.output.briefsCreated ?? 0) > 0 && (
                  <StatCard label="Briefs generados" value={agentRun.output.briefsCreated!} color="#3b82f6" />
                )}
              </div>

              {/* Proposals display */}
              {agentRun.output.proposals && agentRun.output.proposals.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <h4 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                      Journeys propuestos
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {agentRun.output.proposals.map((proposal, i) => (
                        <ProposalCard key={i} proposal={proposal} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)", gap: 16, alignItems: "start" }}>
      {/* Section 3: Briefs generados */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 22, color: "var(--foreground)" }}>Briefs generados</h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Briefs disponibles para generar historias.
          </p>
        </div>

        {/* Filter bar */}
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Filtrar:</span>
          <select
            value={briefLanguageFilter}
            onChange={(e) => setBriefLanguageFilter(e.target.value)}
            style={{
              fontSize: 12,
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid var(--card-border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              cursor: "pointer",
            }}
          >
            <option value="all">Todos los idiomas</option>
            {uniqueLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            value={briefLevelFilter}
            onChange={(e) => setBriefLevelFilter(e.target.value)}
            style={{
              fontSize: 12,
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid var(--card-border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              cursor: "pointer",
            }}
          >
            <option value="all">Todos los niveles</option>
            {uniqueLevels.map((level) => (
              <option key={level} value={level}>
                {level.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            value={briefStatusFilter}
            onChange={(e) => setBriefStatusFilter(e.target.value)}
            style={{
              fontSize: 12,
              padding: "5px 10px",
              borderRadius: 6,
              border: "1px solid var(--card-border)",
              backgroundColor: "var(--background)",
              color: "var(--foreground)",
              cursor: "pointer",
            }}
          >
            <option value="all">Todos los estados</option>
            {uniqueStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
            {filteredBriefs.length} brief{filteredBriefs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {briefError && (
          <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>
            {briefError}
          </p>
        )}

        {brieferLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="studio-skeleton" style={{ height: 70 }} />
            ))}
          </div>
        ) : filteredBriefs.length === 0 ? (
          <div
            style={{
              padding: "44px 16px",
              textAlign: "center",
              borderRadius: 12,
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            <p style={{ fontSize: 40, margin: "0 0 12px" }}>📋</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
              No hay briefs con estos filtros
            </p>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "8px 0 0" }}>
              Ejecuta un análisis para generar briefs.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredBriefs.map((brief) => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
          </div>
        )}
      </section>

      {/* Section 4: Historial de ejecuciones */}
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 22, color: "var(--foreground)" }}>Historial de ejecuciones</h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Últimas 10 ejecuciones del Planner Agent.
          </p>
        </div>

        {historyError && (
          <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>
            {historyError}
          </p>
        )}

        {historyLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="studio-skeleton" style={{ height: 70 }} />
            ))}
          </div>
        ) : runHistory.length === 0 ? (
          <div
            style={{
              padding: "44px 16px",
              textAlign: "center",
              borderRadius: 12,
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            <p style={{ fontSize: 40, margin: "0 0 12px" }}>📊</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
              Sin historial de ejecuciones
            </p>
            <p style={{ fontSize: 14, color: "var(--muted)", margin: "8px 0 0" }}>
              No hay ejecuciones registradas aún.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {runHistory.map((run) => (
              <RunHistoryCard key={run.runId} run={run} />
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
