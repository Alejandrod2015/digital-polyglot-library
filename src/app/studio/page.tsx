import { readFile } from "fs/promises";
import { join } from "path";
import type { CSSProperties } from "react";
import { Prisma } from "@/generated/prisma";
import StudioActionLink from "@/components/studio/StudioActionLink";
import StudioShell from "@/components/studio/StudioShell";
import DirectivePanel from "@/components/studio/DirectivePanel";
import { prisma } from "@/lib/prisma";
import { requireStudioUser } from "@/lib/requireStudioUser";

type DraftStatus =
  | "draft"
  | "generated"
  | "qa_pass"
  | "qa_fail"
  | "needs_review"
  | "approved"
  | "published";

type AgentRunStatus = "queued" | "running" | "completed" | "failed" | "needs_review";
type AgentKind = "planner" | "content" | "qa";
type AgentRunRecord = {
  id: string;
  agentKind: AgentKind;
  status: AgentRunStatus;
  createdAt: Date;
  errorMessage: string | null;
  output: unknown;
};

type DashboardStats = {
  draftCounts: Record<DraftStatus, number>;
  totalDrafts: number;
  pendingDrafts: number;
  readyToPublish: number;
  pendingBriefs: number;
  latestQaAt: string | null;
  qaIssues: number;
  qaCriticalIssues: number;
  latestPipelineRun: {
    status: AgentRunStatus;
    createdAt: Date;
  } | null;
  recentRuns: AgentRunRecord[];
  recentDrafts: Array<{
    id: string;
    title: string;
    status: DraftStatus;
    updatedAt: Date;
  }>;
  recentPlannerRuns: number;
  recentContentRuns: number;
  recentQaRuns: number;
  latestFailedRun: AgentRunRecord | null;
  lastRunByKind: Partial<Record<AgentKind, AgentRunRecord>>;
};

type NextAction = {
  title: string;
  description: string;
  href: string;
  pendingLabel: string;
  tone: "danger" | "warning" | "success" | "neutral";
};

type AttentionItem = {
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: "danger" | "warning" | "neutral";
};

type AgentStatusCard = {
  name: string;
  href: string;
  status: "ok" | "attention" | "error" | "idle";
  cta: string;
  metric: string;
  detail: string;
  alert: string;
};

const DRAFT_STATUSES: DraftStatus[] = [
  "draft",
  "generated",
  "qa_pass",
  "qa_fail",
  "needs_review",
  "approved",
  "published",
];

const statusLabel: Record<DraftStatus, string> = {
  draft: "Borrador",
  generated: "Generado",
  qa_pass: "QA OK",
  qa_fail: "QA fallida",
  needs_review: "Revisión",
  approved: "Aprobado",
  published: "Publicado",
};

const statusTone: Record<NextAction["tone"], { border: string; background: string; accent: string }> = {
  danger: {
    border: "rgba(239, 68, 68, 0.28)",
    background: "rgba(239, 68, 68, 0.1)",
    accent: "#fca5a5",
  },
  warning: {
    border: "rgba(245, 158, 11, 0.28)",
    background: "rgba(245, 158, 11, 0.1)",
    accent: "#fcd34d",
  },
  success: {
    border: "rgba(20, 184, 166, 0.28)",
    background: "rgba(20, 184, 166, 0.1)",
    accent: "#5eead4",
  },
  neutral: {
    border: "var(--card-border)",
    background: "rgba(255,255,255,0.02)",
    accent: "#93c5fd",
  },
};

const sectionCard: CSSProperties = {
  padding: 20,
  borderRadius: 14,
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
};

const compactCard: CSSProperties = {
  borderRadius: 12,
  backgroundColor: "var(--card-bg)",
  border: "1px solid var(--card-border)",
};

function formatRelative(date: Date | string | null) {
  if (!date) return "Sin registros";
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.RelativeTimeFormat("es", { numeric: "auto" }).format(
    ...getRelativeParts(value)
  );
}

function getRelativeParts(date: Date): [number, Intl.RelativeTimeFormatUnit] {
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < hour) {
    return [Math.round(diffMs / minute), "minute"];
  }
  if (absMs < day) {
    return [Math.round(diffMs / hour), "hour"];
  }
  return [Math.round(diffMs / day), "day"];
}

function getPipelineStatus(stats: DashboardStats) {
  if (stats.latestPipelineRun?.status === "running") {
    return {
      label: "En curso",
      tone: "warning" as const,
      detail: `Pipeline activo ${formatRelative(stats.latestPipelineRun.createdAt)}`,
      subdetail: "Hay agentes trabajando ahora mismo",
      href: "/studio",
      cta: "Ver ejecución",
    };
  }

  if (stats.latestFailedRun) {
    const failedAgent = labelAgent(stats.latestFailedRun.agentKind);
    return {
      label: `Error en ${failedAgent}`,
      tone: "danger" as const,
      detail: getRunSummary(stats.latestFailedRun),
      subdetail: `Fallo ${formatRelative(stats.latestFailedRun.createdAt)}`,
      href: getAgentHref(stats.latestFailedRun.agentKind),
      cta: "Ver error",
    };
  }

  if (stats.qaCriticalIssues > 0 || stats.draftCounts.qa_fail > 0) {
    return {
      label: "Requiere atención",
      tone: "warning" as const,
      detail: "Hay incidencias de QA o borradores bloqueados",
      subdetail: `${stats.qaCriticalIssues} críticas y ${stats.draftCounts.qa_fail} QA fail`,
      href: "/studio/qa",
      cta: "Abrir QA",
    };
  }

  return {
    label: "Operativo",
    tone: "success" as const,
    detail: stats.latestPipelineRun
      ? `Última ejecución ${formatRelative(stats.latestPipelineRun.createdAt)}`
      : "Sin ejecuciones recientes",
    subdetail: "Sin fallos recientes en los agentes",
    href: "/studio/metrics",
    cta: "Ver métricas",
  };
}

function getNextAction(stats: DashboardStats): NextAction {
  if (stats.draftCounts.qa_fail > 0) {
    return {
      title: `Corregir ${stats.draftCounts.qa_fail} fallo${stats.draftCounts.qa_fail === 1 ? "" : "s"} de QA`,
      description: "Empieza por los borradores rechazados para desbloquear el flujo.",
      href: "/studio/drafts",
      pendingLabel: "Abriendo borradores con QA fallida...",
      tone: "danger",
    };
  }

  if (stats.draftCounts.needs_review > 0) {
    return {
      title: `Revisar ${stats.draftCounts.needs_review} borrador${stats.draftCounts.needs_review === 1 ? "" : "es"}`,
      description: "Hay contenido esperando validación editorial antes de aprobarse.",
      href: "/studio/drafts",
      pendingLabel: "Abriendo borradores pendientes...",
      tone: "warning",
    };
  }

  if (stats.readyToPublish > 0) {
    return {
      title: `Publicar ${stats.readyToPublish} journey${stats.readyToPublish === 1 ? "" : "s"} listo${stats.readyToPublish === 1 ? "" : "s"}`,
      description: "Ya hay contenido aprobado que puede pasar a publicado hoy.",
      href: "/studio/drafts",
      pendingLabel: "Abriendo contenido listo para publicar...",
      tone: "success",
    };
  }

  if (stats.pendingBriefs > 0 || stats.draftCounts.draft > 0 || stats.draftCounts.generated > 0) {
    return {
      title: "Ejecutar pipeline",
      description: "Hay briefs o borradores tempranos que aún no han cruzado todo el flujo.",
      href: "/studio",
      pendingLabel: "Preparando pipeline...",
      tone: "neutral",
    };
  }

  return {
    title: "Revisar actividad reciente",
    description: "No hay bloqueos fuertes ahora mismo; revisa los últimos cambios del equipo.",
    href: "/studio/metrics",
    pendingLabel: "Abriendo métricas...",
    tone: "neutral",
  };
}

function buildAttentionItems(stats: DashboardStats): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (stats.draftCounts.qa_fail > 0) {
    items.push({
      title: `${stats.draftCounts.qa_fail} borrador${stats.draftCounts.qa_fail === 1 ? "" : "es"} con QA fallida`,
      detail: "Contenido bloqueado hasta corregir problemas detectados por QA.",
      href: "/studio/drafts",
      cta: "Abrir borradores",
      tone: "danger",
    });
  }

  if (stats.qaCriticalIssues > 0) {
    items.push({
      title: `${stats.qaCriticalIssues} incidencia${stats.qaCriticalIssues === 1 ? "" : "s"} crítica${stats.qaCriticalIssues === 1 ? "" : "s"} en QA`,
      detail: "La app tiene problemas marcados como críticos en el último reporte.",
      href: "/studio/qa",
      cta: "Abrir QA",
      tone: "danger",
    });
  }

  if (stats.draftCounts.needs_review > 0) {
    items.push({
      title: `${stats.draftCounts.needs_review} borrador${stats.draftCounts.needs_review === 1 ? "" : "es"} en revisión`,
      detail: "Requieren decisión editorial para avanzar a aprobado.",
      href: "/studio/drafts",
      cta: "Revisar ahora",
      tone: "warning",
    });
  }

  if (stats.pendingBriefs > 0) {
    items.push({
      title: `${stats.pendingBriefs} brief${stats.pendingBriefs === 1 ? "" : "s"} pendiente${stats.pendingBriefs === 1 ? "" : "s"}`,
      detail: "Hay planificación detectada que todavía no se ha convertido en historias completas.",
      href: "/studio/planner",
      cta: "Abrir Planner",
      tone: "warning",
    });
  }

  if (stats.readyToPublish > 0) {
    items.push({
      title: `${stats.readyToPublish} item${stats.readyToPublish === 1 ? "" : "s"} listo${stats.readyToPublish === 1 ? "" : "s"} para publicar`,
      detail: "Contenido ya validado que puede pasar a biblioteca publicada.",
      href: "/studio/drafts",
      cta: "Publicar contenido",
      tone: "neutral",
    });
  }

  if (items.length === 0) {
    items.push({
      title: "No hay bloqueos prioritarios",
      detail: "El flujo está limpio. Puedes usar el pipeline o revisar métricas para seguir optimizando.",
      href: "/studio/metrics",
      cta: "Ver métricas",
      tone: "neutral",
    });
  }

  return items.slice(0, 5);
}

function buildActivity(stats: DashboardStats) {
  const runEvents = stats.recentRuns.map((run) => ({
    id: `run-${run.id}`,
    date: run.createdAt,
    title: `${labelAgent(run.agentKind)} ${labelRunStatus(run.status)}`,
    detail: `${labelAgent(run.agentKind)} ${formatRelative(run.createdAt)}`,
  }));

  const draftEvents = stats.recentDrafts.map((draft) => ({
    id: `draft-${draft.id}`,
    date: draft.updatedAt,
    title: `${draft.title || "Borrador sin título"} en ${statusLabel[draft.status]}`,
    detail: `Actualizado ${formatRelative(draft.updatedAt)}`,
  }));

  return [...runEvents, ...draftEvents]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);
}

function buildAgentCards(stats: DashboardStats): AgentStatusCard[] {
  const plannerLastRun = stats.lastRunByKind.planner;
  const contentLastRun = stats.lastRunByKind.content;
  const qaLastRun = stats.lastRunByKind.qa;
  const plannerStatus =
    plannerLastRun?.status === "failed" ? "error" : stats.pendingBriefs > 0 ? "attention" : stats.recentPlannerRuns > 0 ? "ok" : "idle";
  const contentFailures = stats.draftCounts.qa_fail;
  const contentWaiting = stats.draftCounts.draft + stats.draftCounts.generated;
  const contentStatus =
    contentLastRun?.status === "failed" ? "error" : contentFailures > 0 ? "error" : contentWaiting > 0 ? "attention" : stats.recentContentRuns > 0 ? "ok" : "idle";
  const qaBlocked = stats.draftCounts.qa_fail + stats.draftCounts.needs_review;
  const qaStatus =
    qaLastRun?.status === "failed" || stats.qaCriticalIssues > 0 ? "error" : qaBlocked > 0 ? "attention" : stats.recentQaRuns > 0 ? "ok" : "idle";

  return [
    {
      name: "Planner",
      href: "/studio/planner",
      status: plannerStatus,
      cta: plannerStatus === "error" ? "Ver fallo" : "Abrir",
      metric: `${stats.pendingBriefs}`,
      detail: "briefs pendientes",
      alert:
        plannerLastRun?.status === "failed"
          ? getRunSummary(plannerLastRun)
          : stats.pendingBriefs > 0
          ? `${stats.pendingBriefs} briefs por convertir`
          : stats.recentPlannerRuns > 0
            ? "Sin backlog inmediato"
            : "Sin ejecuciones recientes",
    },
    {
      name: "Content",
      href: "/studio/content",
      status: contentStatus,
      cta: contentStatus === "error" ? "Ver fallo" : "Abrir",
      metric: `${contentWaiting}`,
      detail: "items esperando generacion",
      alert:
        contentLastRun?.status === "failed"
          ? getRunSummary(contentLastRun)
          : contentFailures > 0
          ? `${contentFailures} borradores bloqueados`
          : contentWaiting > 0
            ? `${contentWaiting} items por mover`
            : "Generación al día",
    },
    {
      name: "QA",
      href: "/studio/qa",
      status: qaStatus,
      cta: qaStatus === "error" ? "Ver fallo" : "Abrir",
      metric: `${stats.qaCriticalIssues > 0 ? stats.qaCriticalIssues : qaBlocked}`,
      detail: stats.qaCriticalIssues > 0 ? "issues críticas" : "items con atención",
      alert:
        qaLastRun?.status === "failed"
          ? getRunSummary(qaLastRun)
          : stats.qaCriticalIssues > 0
          ? `${stats.qaCriticalIssues} incidencias críticas`
          : qaBlocked > 0
            ? `${qaBlocked} items bloqueados o en revisión`
            : "QA estable",
    },
  ];
}

function getRunSummary(run: Pick<AgentRunRecord, "errorMessage" | "output" | "agentKind">) {
  const output = run.output as { summary?: unknown } | null;
  const raw = typeof output?.summary === "string" && output.summary.trim()
    ? output.summary
    : run.errorMessage?.trim() || "";

  if (!raw) {
    return `${labelAgent(run.agentKind)} sin detalle adicional`;
  }

  return raw.length > 72 ? `${raw.slice(0, 69)}...` : raw;
}

function getAgentHref(kind: AgentKind) {
  if (kind === "planner") return "/studio/planner";
  if (kind === "content") return "/studio/content";
  return "/studio/qa";
}

function statusBadge(status: AgentStatusCard["status"]) {
  if (status === "error") return { label: "Error", tone: "danger" as const };
  if (status === "attention") return { label: "Atención", tone: "warning" as const };
  if (status === "ok") return { label: "OK", tone: "success" as const };
  return { label: "Idle", tone: "neutral" as const };
}

function labelAgent(kind: AgentKind) {
  if (kind === "planner") return "Planner";
  if (kind === "content") return "Content Agent";
  return "QA Agent";
}

function labelRunStatus(status: AgentRunStatus) {
  if (status === "completed") return "completo";
  if (status === "failed") return "fallo";
  if (status === "running") return "en ejecución";
  if (status === "needs_review") return "requiere revisión";
  return "en cola";
}

async function getDashboardStats(): Promise<DashboardStats> {
  const storyDraftModel = (prisma as any).storyDraft;
  const briefModel = (prisma as any).curriculumBrief;

  const [draftStatusGroups, totalDrafts, pendingBriefs, recentRuns, recentDrafts, qaReport] =
    await Promise.all([
      storyDraftModel.groupBy({
        by: ["status"],
        _count: true,
      }),
      storyDraftModel.count(),
      briefModel.count({ where: { status: "draft" } }),
      loadRecentAgentRuns(),
      storyDraftModel.findMany({
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
      readLatestQaReport(),
    ]);

  const draftCounts = DRAFT_STATUSES.reduce(
    (acc, status) => {
      acc[status] = 0;
      return acc;
    },
    {} as Record<DraftStatus, number>
  );

  draftStatusGroups.forEach((item: { status: DraftStatus; _count: number }) => {
    if (item.status in draftCounts) {
      draftCounts[item.status] = item._count;
    }
  });

  const latestPipelineRun =
    recentRuns.length > 0
      ? {
          status: recentRuns[0].status,
          createdAt: recentRuns[0].createdAt,
        }
      : null;
  const latestFailedRun = recentRuns.find((run) => run.status === "failed") ?? null;
  const lastRunByKind: Partial<Record<AgentKind, AgentRunRecord>> = {};
  recentRuns.forEach((run) => {
    if (!lastRunByKind[run.agentKind]) {
      lastRunByKind[run.agentKind] = run;
    }
  });

  return {
    draftCounts,
    totalDrafts,
    pendingDrafts:
      draftCounts.draft +
      draftCounts.generated +
      draftCounts.qa_fail +
      draftCounts.needs_review,
    readyToPublish: draftCounts.approved,
    pendingBriefs,
    latestQaAt: qaReport.generatedAt,
    qaIssues: qaReport.total,
    qaCriticalIssues: qaReport.critical,
    latestPipelineRun,
    recentRuns,
    recentDrafts,
    recentPlannerRuns: recentRuns.filter((run) => run.agentKind === "planner").length,
    recentContentRuns: recentRuns.filter((run) => run.agentKind === "content").length,
    recentQaRuns: recentRuns.filter((run) => run.agentKind === "qa").length,
    latestFailedRun,
    lastRunByKind,
  };
}

async function loadRecentAgentRuns(): Promise<AgentRunRecord[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    agent_kind: string;
    status: string;
    created_at: Date;
    error_message: string | null;
    output: Prisma.JsonValue | null;
  }>>(Prisma.sql`
    SELECT
      id,
      "agentKind"::text AS agent_kind,
      status::text AS status,
      "createdAt" AS created_at,
      "errorMessage" AS error_message,
      output
    FROM "dp_agent_runs_v1"
    WHERE "agentKind"::text IN ('planner', 'content', 'qa')
    ORDER BY "createdAt" DESC
    LIMIT 12
  `);

  return rows.map((row) => ({
    id: row.id,
    agentKind: row.agent_kind as AgentKind,
    status: row.status as AgentRunStatus,
    createdAt: new Date(row.created_at),
    errorMessage: row.error_message,
    output: row.output,
  }));
}

async function readLatestQaReport() {
  try {
    const raw = await readFile(join(process.cwd(), "qa", "latest-report.json"), "utf-8");
    const parsed = JSON.parse(raw) as {
      generatedAt?: string;
      summary?: { total?: number; critical?: number };
    };

    return {
      generatedAt: parsed.generatedAt ?? null,
      total: parsed.summary?.total ?? 0,
      critical: parsed.summary?.critical ?? 0,
    };
  } catch {
    return {
      generatedAt: null,
      total: 0,
      critical: 0,
    };
  }
}

function KpiCard({
  label,
  value,
  detail,
  subdetail,
  href,
  cta,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  subdetail?: string;
  href?: string;
  cta?: string;
  tone?: NextAction["tone"];
}) {
  const colors = statusTone[tone];

  return (
    <div
      style={{
        ...compactCard,
        padding: 14,
        background: colors.background,
        borderColor: colors.border,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", fontWeight: 700 }}>
            {label}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 16, lineHeight: 1.2, color: "var(--foreground)", fontWeight: 700 }}>
            {value}
          </p>
        </div>
        {href && cta ? (
          <StudioActionLink
            href={href}
            pendingLabel={`Abriendo ${cta.toLowerCase()}...`}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid var(--card-border)",
              backgroundColor: "transparent",
              color: "var(--foreground)",
              fontWeight: 600,
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            {cta}
          </StudioActionLink>
        ) : null}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: colors.accent, lineHeight: 1.35 }}>
        {detail}
      </p>
      {subdetail ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.35 }}>
          {subdetail}
        </p>
      ) : null}
    </div>
  );
}

export default async function StudioOverviewPage() {
  await requireStudioUser("/studio");

  const stats = await getDashboardStats();
  const pipelineStatus = getPipelineStatus(stats);
  const nextAction = getNextAction(stats);
  const attentionItems = buildAttentionItems(stats);
  const activityItems = buildActivity(stats);
  const agentCards = buildAgentCards(stats);

  return (
    <StudioShell
      title="Resumen operativo"
      description="Qué requiere atención, qué puedes desbloquear ahora y cómo avanza el pipeline."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <DirectivePanel />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          <KpiCard
            label="Pipeline"
            value={pipelineStatus.label}
            detail={pipelineStatus.detail}
            subdetail={pipelineStatus.subdetail}
            href={pipelineStatus.href}
            cta={pipelineStatus.cta}
            tone={pipelineStatus.tone}
          />
          <KpiCard
            label="Pendientes"
            value={`${stats.pendingDrafts} activos`}
            detail={`${stats.pendingBriefs} briefs y ${stats.pendingDrafts} items por mover`}
            href={stats.pendingDrafts > 0 || stats.pendingBriefs > 0 ? "/studio/drafts" : "/studio/planner"}
            cta={stats.pendingDrafts > 0 || stats.pendingBriefs > 0 ? "Abrir" : "Planner"}
            tone={stats.pendingDrafts > 0 || stats.pendingBriefs > 0 ? "warning" : "success"}
          />
          <KpiCard
            label="Listo para publicar"
            value={`${stats.readyToPublish} listos`}
            detail={stats.readyToPublish > 0 ? "Contenido aprobado disponible hoy" : "Nada listo aún"}
            href="/studio/drafts"
            cta="Publicar"
            tone={stats.readyToPublish > 0 ? "success" : "neutral"}
          />
          <KpiCard
            label="QA"
            value={stats.qaIssues > 0 ? `${stats.qaIssues} issues` : "Limpio"}
            detail={stats.latestQaAt ? `Último reporte ${formatRelative(stats.latestQaAt)}` : "Sin reporte reciente"}
            subdetail={stats.qaCriticalIssues > 0 ? `${stats.qaCriticalIssues} críticas detectadas` : undefined}
            href="/studio/qa"
            cta="Abrir QA"
            tone={stats.qaCriticalIssues > 0 ? "danger" : stats.qaIssues > 0 ? "warning" : "success"}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 0.95fr)",
            gap: 12,
            alignItems: "start",
          }}
        >
          <div
            style={{
              ...compactCard,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: 16,
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
                Siguiente acción
              </p>
              <h3 style={{ margin: "6px 0 0", fontSize: 18, lineHeight: 1.2, color: "var(--foreground)" }}>
                {nextAction.title}
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", maxWidth: 620, lineHeight: 1.4 }}>
                {nextAction.description}
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <StudioActionLink
                href={nextAction.href}
                pendingLabel={nextAction.pendingLabel}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "var(--primary)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                Abrir tarea
              </StudioActionLink>
              <StudioActionLink
                href="/studio/drafts"
                pendingLabel="Abriendo borradores..."
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--card-border)",
                  backgroundColor: "transparent",
                  color: "var(--foreground)",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Borradores
              </StudioActionLink>
              <StudioActionLink
                href="/studio/qa"
                pendingLabel="Abriendo QA..."
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--card-border)",
                  backgroundColor: "transparent",
                  color: "var(--foreground)",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                QA
              </StudioActionLink>
              <StudioActionLink
                href="/studio/metrics"
                pendingLabel="Abriendo métricas..."
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--card-border)",
                  backgroundColor: "transparent",
                  color: "var(--foreground)",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Métricas
              </StudioActionLink>
            </div>
          </div>

          <div style={{ ...compactCard, display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
                Atención requerida
              </p>
              <h3 style={{ margin: "6px 0 0", fontSize: 18, color: "var(--foreground)" }}>Bloqueos y avisos</h3>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {attentionItems.slice(0, 3).map((item) => {
                const colors = statusTone[item.tone];
                return (
                  <div
                    key={item.title}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.accent }}>{item.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.35 }}>{item.detail}</p>
                    </div>
                    <StudioActionLink
                      href={item.href}
                      pendingLabel={`Abriendo ${item.cta.toLowerCase()}...`}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--card-border)",
                        backgroundColor: "transparent",
                        color: "var(--foreground)",
                        fontWeight: 600,
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.cta}
                    </StudioActionLink>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {agentCards.map((card) => {
            const badge = statusBadge(card.status);
            const colors = statusTone[badge.tone];

            return (
              <div
                key={card.name}
                style={{
                  ...compactCard,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{card.name}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: colors.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      {badge.label}
                    </p>
                  </div>
                  <StudioActionLink
                    href={card.href}
                    pendingLabel={`Abriendo ${card.name.toLowerCase()}...`}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--card-border)",
                      backgroundColor: "transparent",
                      color: "var(--foreground)",
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    {card.cta}
                  </StudioActionLink>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.1 }}>{card.metric}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{card.detail}</p>
                </div>

                <p style={{ margin: 0, fontSize: 12, color: colors.accent, lineHeight: 1.35 }}>{card.alert}</p>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
            gap: 14,
            alignItems: "start",
          }}
        >
          <div style={{ ...sectionCard, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
                Flujo de trabajo
              </p>
              <h3 style={{ margin: "6px 0 0", fontSize: 18, color: "var(--foreground)" }}>Estado del contenido</h3>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                gap: 12,
              }}
            >
              {[
                { label: "Briefs", value: stats.pendingBriefs, detail: "Pendientes de generar", tone: "warning" as const },
                { label: "Generado", value: stats.draftCounts.generated, detail: "Listo para QA", tone: "neutral" as const },
                { label: "Revisión", value: stats.draftCounts.needs_review, detail: "Decisión editorial", tone: "warning" as const },
                { label: "Aprobado", value: stats.draftCounts.approved, detail: "Publicable", tone: "success" as const },
                { label: "Publicado", value: stats.draftCounts.published, detail: "Ya en catálogo", tone: "success" as const },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: statusTone[item.tone].background,
                    border: `1px solid ${statusTone[item.tone].border}`,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                    {item.label}
                  </p>
                  <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 700, color: "var(--foreground)" }}>{item.value}</p>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: statusTone[item.tone].accent }}>{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...sectionCard, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
                Actividad reciente
              </p>
              <h3 style={{ margin: "6px 0 0", fontSize: 18, color: "var(--foreground)" }}>Últimos cambios relevantes</h3>
            </div>

            {activityItems.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Todavía no hay actividad para mostrar.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {activityItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      paddingBottom: 12,
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{item.title}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>{item.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
