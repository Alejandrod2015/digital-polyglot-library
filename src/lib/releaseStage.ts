// Etapas de despliegue por tamaño de base de usuarios, y las piezas que cada
// una exige. Es la version en codigo de docs/plan-despliegue-por-etapas.md:
// el digest semanal lee de aqui la etapa actual (por DAU medido), el siguiente
// disparador y las piezas que faltan, para que el plan busque al usuario cada
// lunes en vez de esperar a que alguien se acuerde de el.
//
// Que cada pieza este hecha o no lo mide scripts/checkReleaseReadiness.ts, que
// escribe src/data/releaseReadiness.json. Las piezas `auto` las detecta ese
// script en el repo; las `manual` viven en scripts/release-readiness-manual.json
// con fecha y prueba, porque no hay archivo del repo que las delate (un ajuste
// en Play Console, un proyecto en Vercel); las `process` no se marcan nunca:
// son disciplina, no estado.

export type ReleaseItemKind = "auto" | "manual" | "process";

export type ReleaseItem = {
  id: string;
  label: string;
  kind: ReleaseItemKind;
};

export type ReleaseStage = {
  /** 0 es la linea de base, previa al lanzamiento; 1 a 3 son las etapas. */
  n: 0 | 1 | 2 | 3;
  name: string;
  /** Usuarios activos al dia a partir de los cuales la etapa aplica. */
  minDau: number;
  items: ReleaseItem[];
};

// Los cortes de 300 y 3.000 DAU son criterio propio (2026-09-06), sin dato que
// los respalde; se ajustan aqui y el digest los recoge solo.
export const RELEASE_STAGES: ReleaseStage[] = [
  {
    n: 0,
    name: "Baseline (before public launch)",
    minDau: 0,
    items: [
      { id: "mobile-sentry", label: "Sentry in the mobile app, with release health", kind: "auto" },
      { id: "mobile-ota", label: "expo-updates with runtimeVersion policy fingerprint", kind: "auto" },
      { id: "eas-channels", label: "EAS build profiles bound to preview / production channels", kind: "auto" },
      { id: "comms-gate-ota", label: "Comms claim gate checks the OTA channel, not only the store build", kind: "auto" },
    ],
  },
  {
    n: 1,
    name: "Launch (up to ~300 DAU)",
    minDau: 1,
    items: [
      { id: "ci-workflows", label: "GitHub Actions on every PR: typecheck, lints, tests", kind: "auto" },
      { id: "cron-env-guard", label: "Crons and outbound senders refuse to run outside production", kind: "auto" },
      { id: "ignore-build-branch", label: "vercel-ignore-build.sh takes the deploy branch from env", kind: "auto" },
      { id: "staging-project", label: "Staging Vercel project on a Neon branch with anonymised emails", kind: "manual" },
      { id: "play-staged-rollout", label: "Play promotions start at 20%, iOS Phased Release on", kind: "manual" },
      { id: "neon-restore-drill", label: "Neon PITR window confirmed and one restore rehearsed", kind: "manual" },
      { id: "abort-threshold", label: "Abort rule written in absolutes (3 distinct users crashing in 1h)", kind: "manual" },
      { id: "expand-contract", label: "Expand/contract migrations: never drop a column in the release that stops using it", kind: "process" },
      { id: "weekly-train", label: "Fixed weekly release train; hotfixes ride their own lane", kind: "process" },
    ],
  },
  {
    n: 2,
    name: "Growth (~300 to 3,000 DAU)",
    minDau: 300,
    items: [
      { id: "rolling-releases", label: "Vercel Rolling Releases 5 > 25 > 100 with Skew Protection", kind: "manual" },
      { id: "ota-rollout", label: "eas update --rollout-percentage 5 > 25 > 100 with 30 min between steps", kind: "process" },
      { id: "feature-flags", label: "Feature flags: deploy and release are no longer the same act", kind: "auto" },
      { id: "e2e-money-paths", label: "e2e on sign-up and the paywall up to the purchase sheet, in CI", kind: "auto" },
      { id: "min-app-version", label: "N-2 support window with a forced-update screen below it", kind: "auto" },
      { id: "public-beta-ring", label: "Public beta ring: external TestFlight and Play open testing", kind: "manual" },
    ],
  },
  {
    n: 3,
    name: "Scale (over 3,000 DAU)",
    minDau: 3000,
    items: [
      { id: "auto-canary-revert", label: "Continuous deploy with a canary that reverts itself on threshold", kind: "manual" },
      { id: "two-phase-migrations", label: "Two-phase migrations with background backfill; read replica", kind: "process" },
      { id: "api-versioning", label: "Explicit API versioning and contract tests app vs API", kind: "auto" },
      { id: "slo-alerts-status", label: "SLO with error budget, paging alerts, public status page", kind: "manual" },
      { id: "ci-store-submit", label: "Store submit from CI, not from a laptop", kind: "auto" },
    ],
  },
];

export type ReleaseReadiness = {
  generatedAt: string;
  /** id de pieza -> hecha o no. Las `process` no aparecen. */
  status: Record<string, boolean>;
};

export function stageForDau(dau: number): ReleaseStage {
  let cur = RELEASE_STAGES[0];
  for (const s of RELEASE_STAGES) if (dau >= s.minDau) cur = s;
  return cur;
}

export function nextStageAfter(stage: ReleaseStage): ReleaseStage | null {
  return RELEASE_STAGES.find((s) => s.n === stage.n + 1) ?? null;
}

export function pendingItems(stage: ReleaseStage, r: ReleaseReadiness): ReleaseItem[] {
  return stage.items.filter((it) => it.kind !== "process" && !r.status[it.id]);
}

export type ReleaseStageReport = {
  dau: number;
  current: ReleaseStage;
  /** Piezas de la linea de base que faltan, siempre primero: sin ellas no hay etapa. */
  baselinePending: ReleaseItem[];
  currentPending: ReleaseItem[];
  next: ReleaseStage | null;
  /** DAU que faltan para el siguiente disparador (0 si ya se cumple). */
  dauToNext: number;
};

export function releaseStageReport(dau: number, r: ReleaseReadiness): ReleaseStageReport {
  const current = stageForDau(dau);
  const baseline = RELEASE_STAGES[0];
  const next = nextStageAfter(current);
  return {
    dau,
    current,
    baselinePending: current.n === 0 ? [] : pendingItems(baseline, r),
    currentPending: pendingItems(current, r),
    next,
    dauToNext: next ? Math.max(0, next.minDau - dau) : 0,
  };
}
