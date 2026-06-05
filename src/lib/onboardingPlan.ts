// Source of truth for the onboarding & lifecycle-automation plan UI at
// /studio/onboarding. Derived from the research synthesis in
// docs/onboarding-automation-research.md (deep-research, 2026-06-04).
//
// Update this file as phases land; keep the doc + Claude memory
// (project_onboarding_automation_research.md) in sync.

import type { RoadmapStatus } from "@/lib/assetRoadmap";

export type Confidence = "alta" | "media" | "baja";

export type Priority = {
  rank: number;
  title: string;
  detail: string;
  confidence: Confidence;
};

export type FlowStep = {
  n: number;
  title: string;
  detail: string;
  signup?: boolean; // marks the deferred-signup moment
};

export type EmailRow = {
  trigger: string;
  email: string;
  cta: string;
  kind: "welcome" | "activation" | "celebration" | "educational" | "recap" | "winback";
};

export type PlanPhase = {
  id: number;
  title: string;
  goal: string;
  status: RoadmapStatus;
  note?: string;
};

export type Benchmark = { metric: string; value: string; note: string };

export type OnboardingPlan = {
  lastUpdated: string;
  docRef: string;
  northStar: string;
  northStarNote: string;
  priorities: Priority[];
  targetFlow: FlowStep[];
  emailSequence: EmailRow[];
  phases: PlanPhase[];
  benchmarks: Benchmark[];
  caveats: string[];
  sources: { label: string; url: string }[];
};

export const ONBOARDING_PLAN: OnboardingPlan = {
  lastUpdated: "2026-06-04",
  docRef: "docs/onboarding-automation-research.md",
  northStar:
    "Aha moment de DPL = «primera historia terminada».",
  northStarNote:
    "Único evento con evidencia directa de una app casi idéntica (LingQ + Amplitude) y respaldado por un RCT (storytelling > drill en retención de vocabulario). Instrumentar story_completed y medir activation_rate + time-to-activate. La primera historia debe ser corta o segmentada para garantizar el primer remate.",

  priorities: [
    {
      rank: 1,
      title: "Welcome email instantáneo (gap #1)",
      detail:
        "Hoy DPL no manda ni un email post-signup. El welcome es el activo de lifecycle de mayor apertura (~40-80%). Enganchar al webhook user.created + Resend. Es el cambio de mayor ROI y el más barato.",
      confidence: "alta",
    },
    {
      rank: 2,
      title: "Producto antes de signup",
      detail:
        "Dejar leer/escuchar una historia de muestra SIN cuenta; pedir registro en el momento de «guardar tu progreso». Registro temprano mata activación. Busuu (signup antes de lección) es el anti-patrón a evitar.",
      confidence: "alta",
    },
    {
      rank: 3,
      title: "Primera historia corta a propósito",
      detail:
        "LingQ partió su primera lección en 3 más cortas para garantizar el primer «finish». El remate es lo que engancha; reducir fricción del primer terminado.",
      confidence: "media",
    },
    {
      rank: 4,
      title: "Secuencia de email front-loaded",
      detail:
        "5-6 emails en los primeros 10-14 días, welcome instantáneo, un solo CTA por email, disparo por evento + ramas conductuales, single opt-in. Win-back dentro de los primeros 3-4 días de inactividad.",
      confidence: "alta",
    },
    {
      rank: 5,
      title: "Motor de hábito = interés en el contenido",
      detail:
        "En long-form el predictor de fondo es «leí una historia que me importó y la entendí», no la racha. Usa racha como leading indicator secundario, no como mecánica central. Esta es la pregunta abierta a validar con datos propios.",
      confidence: "media",
    },
    {
      rank: 6,
      title: "Paywall post-engagement (cuando haya premium)",
      detail:
        "Soft paywall con trial, colocado tras lecciones iniciales (estilo Memrise), nunca a mitad del onboarding crítico. Freemium puro convierte ~2-3% vs trials 18-60%.",
      confidence: "alta",
    },
  ],

  targetFlow: [
    {
      n: 1,
      title: "Landing -> historia de muestra sin cuenta",
      detail:
        "Producto primero. Historia corta con audio. Se mantiene el conversion-goal único de la landing (sin links secundarios).",
    },
    {
      n: 2,
      title: "Encuesta breve de personalización",
      detail:
        "Idioma / nivel / interés, integrada en la experiencia (no como muro). 3 opciones simples por pregunta, sin taxonomías complejas.",
    },
    {
      n: 3,
      title: "Al terminar la primera historia -> signup",
      detail:
        "Aha moment alcanzado. Prompt «guarda tu progreso». Registro diferido al momento de valor.",
      signup: true,
    },
    {
      n: 4,
      title: "Post-signup: nivelación opcional + tour ligero",
      detail:
        "Nivelación como nudge, no como muro. Permiso de notificaciones con priming, después del compromiso.",
    },
    {
      n: 5,
      title: "Paywall post-engagement (cuando exista premium)",
      detail:
        "Soft, con trial, tras lecciones iniciales. Multi-ask contextual + exit-intent suave.",
    },
  ],

  emailSequence: [
    {
      trigger: "user.created (instantáneo)",
      email: "Welcome: qué es DPL + invita a terminar tu primera historia",
      cta: "Abre tu primera historia",
      kind: "welcome",
    },
    {
      trigger: "+24h si NO completó 1ª historia",
      email: "Nudge de activación: «tu primera historia te espera, son X minutos»",
      cta: "Termínala ahora",
      kind: "activation",
    },
    {
      trigger: "Al completar 1ª historia (conductual)",
      email: "Celebración: primer logro + sugiere la siguiente",
      cta: "Sigue con la próxima",
      kind: "celebration",
    },
    {
      trigger: "Día 7",
      email: "Progress recap: historias + vocab + racha (si aplica), loss aversion suave",
      cta: "Mantén el ritmo",
      kind: "recap",
    },
    {
      trigger: "Día 10-14",
      email: "Identidad: «ya eres lector», umbral cruzado (antes/después) + siguiente historia",
      cta: "Sigue leyendo",
      kind: "educational",
    },
    {
      trigger: "Inactivo 30-45 días",
      email: "Win-back escalado (3 emails): recordatorio suave -> valor -> incentivo, con sunset",
      cta: "Vuelve a tu historia",
      kind: "winback",
    },
  ],

  phases: [
    {
      id: 1,
      title: "Welcome email",
      goal:
        "Enganchar sendWelcomeEmail() al webhook user.created (src/app/api/webhooks/clerk/route.ts) vía Resend (src/lib/email.ts). Instantáneo, single opt-in, en try/catch para no romper el tracking de signup.",
      status: "local_only",
      note: "Implementado y verificado en local: diseño high-fidelity del handoff (sistema en src/lib/emails/*), enviado real vía Resend. Falta push a main.",
    },
    {
      id: 2,
      title: "Instrumentar activación",
      goal:
        "Emitir UserMetric story_completed como north-star y exponer activation_rate + time-to-activate en /studio/metrics.",
      status: "not_started",
    },
    {
      id: 3,
      title: "Secuencia lifecycle",
      goal:
        "Los 9 emails ya están construidos como builders en src/lib/emails/lifecycle.ts (welcome, nudge, celebration, how-it-works, recap, next, win-back x3). Falta el motor de disparo: cron diario que evalúa el estado de cada usuario nuevo y manda el email que toque (gating por evento). Decidir Resend propio vs Customer.io/Loops.",
      status: "in_progress",
      note: "Diseño + builders implementados (handoff aplicado). Pendiente: triggers/cron y merge de datos reales por usuario.",
    },
    {
      id: 4,
      title: "Reordenar onboarding (producto antes de signup)",
      goal:
        "Permitir abrir una historia de muestra sin cuenta y mover el prompt de registro al «guardar progreso». Cambio de producto más grande; validar con datos propios antes de asumir el +20% de Duolingo.",
      status: "not_started",
    },
    {
      id: 5,
      title: "Paywall post-engagement",
      goal:
        "Cuando exista premium: soft paywall con trial, multi-ask contextual, exit-intent suave. Post-engagement, no en onboarding crítico.",
      status: "not_started",
    },
  ],

  benchmarks: [
    { metric: "Retención D1 educación (buena)", value: "35-40%", note: "«gold» del sector" },
    { metric: "Retención D30 educación", value: "~2-3%", note: "de las peores categorías; no es piso para nicho de calidad" },
    { metric: "Welcome email open", value: "~40-80%", note: "el más alto de la secuencia" },
    { metric: "Open rate email educación", value: "~28-39%", note: "inflado por Apple MPP; prioriza clicks" },
    { metric: "Freemium -> pago", value: "~2-3%", note: "mediana 4.5%" },
    { metric: "Trial -> pago", value: "18-60%", note: "opt-in ~8-22%, opt-out ~35-55%" },
    { metric: "Reactivación win-back 90d / 180d", value: "10-12% / 2-4%", note: "reengancha en los primeros 3-4 días" },
  ],

  caveats: [
    "Racha 3.6x / 2.4x = correlación / survivorship admitida por el propio PM de Duolingo, NO causalidad. Direccional, nunca garantía.",
    "Los benchmarks de hábito vienen del drill-diario de Duolingo; «una historia por día» no es conductualmente equivalente a «una lección de 2 min». Transfieren con cuidado.",
    "El único dato directamente pro-DPL (historias > gamificado) es un solo RCT (n=90, 4 semanas, EFL). Señal fuerte, no consenso de campo.",
    "Los benchmarks de email son genéricos de edtech, no de apps de idiomas concretas. Validar con tus propios envíos.",
    "Refutados (no usar): +1.7% D7 racha-animación; push cap 2/día; Duolingo 5.1% conversión; precios Babbel exactos $14.99/$9.99/$7.99.",
  ],

  sources: [
    { label: "LingQ + Amplitude (activación contenido)", url: "https://amplitude.com/blog/lingq-cdp-increased-conversions" },
    { label: "RCT storytelling vs gamificado (Elsevier 2025)", url: "https://www.sciencedirect.com/science/article/pii/S2666920X25001456" },
    { label: "Duolingo reactivación (Sub Club / Shuttleworth)", url: "https://subclub.com/episode/how-to-time-reactivation-campaigns-for-maximum-impact-jackson-shuttleworth-duolingo" },
    { label: "Babbel teardown (web2app + exit funnel)", url: "https://thegrowthhackinglab.com/case-studies/how-babbel-hits-3m-monthly-revenue-the-paid-ads-and-conversion-machine-behind-a-language-app/" },
    { label: "Email benchmarks (ActiveCampaign)", url: "https://www.activecampaign.com/blog/activecampaign-email-benchmarks" },
    { label: "Trial conversion benchmarks (Adapty)", url: "https://adapty.io/blog/trial-conversion-rates-for-in-app-subscriptions/" },
  ],
};

export function confidenceColor(c: Confidence): { bg: string; fg: string } {
  switch (c) {
    case "alta":
      return { bg: "rgba(16, 185, 129, 0.18)", fg: "#10b981" };
    case "media":
      return { bg: "rgba(245, 158, 11, 0.18)", fg: "#f59e0b" };
    case "baja":
      return { bg: "rgba(239, 68, 68, 0.18)", fg: "#ef4444" };
  }
}
