import type { Insight } from "./MetricsPrimitives";

/**
 * Computes the "Lo que cambió" rail for the Resumen view. The helper
 * is pure and deterministic so it can run server-side or in a
 * useMemo on the client. Cap output at 4 cards — the rail is meant
 * to highlight the load-bearing movements, not every fluctuation.
 */

type Kpis = {
  dau: number;
  wau: number;
  plays: number;
  completions: number;
  completionRate: number;
  uniqueStories: number;
  uniqueBooks: number;
  avgMinutesPerActiveUser: number;
  totalListenedMinutes: number;
  savedStories: number;
  savedBooks: number;
};

type TopStoryByMinutes = {
  storySlug: string;
  listenedMinutes: number;
  listeners: number;
};

type ReminderFunnel = {
  scheduled: number;
  tapped: number;
  destinationOpened: number;
  tapRateFromScheduled: number;
};

type TopSavedStory = { storySlug: string; saves: number };

type Args = {
  curr: Kpis;
  prev?: Partial<Kpis>;
  topStoriesByMinutes: TopStoryByMinutes[];
  topSavedStories: TopSavedStory[];
  reminderFunnel: ReminderFunnel;
};

function pct(curr: number, prev: number): number {
  if (prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
}

export function deriveInsights({
  curr,
  prev,
  topStoriesByMinutes,
  topSavedStories,
  reminderFunnel,
}: Args): Insight[] {
  const out: Insight[] = [];

  if (prev?.completionRate !== undefined) {
    const crDelta = curr.completionRate - prev.completionRate;
    if (Math.abs(crDelta) >= 2) {
      out.push({
        kind: crDelta > 0 ? "up" : "down",
        title: `Completion rate ${crDelta > 0 ? "↑" : "↓"} ${Math.abs(crDelta).toFixed(1)}pp`,
        body: `${curr.completionRate}% vs ${prev.completionRate}% en el periodo anterior.`,
        tag: "Engagement",
      });
    }
  }

  if (prev?.savedStories !== undefined && prev.savedStories > 0) {
    const savesDelta = pct(curr.savedStories, prev.savedStories);
    if (Math.abs(savesDelta) >= 30) {
      const top = topSavedStories[0];
      const body = top
        ? `${curr.savedStories} historias guardadas (vs ${prev.savedStories}). '${top.storySlug}' acumula ${top.saves} saves.`
        : `${curr.savedStories} historias guardadas (vs ${prev.savedStories}).`;
      out.push({
        kind: savesDelta > 0 ? "up" : "down",
        title: `Saves de historia ${savesDelta > 0 ? "+" : ""}${savesDelta.toFixed(0)}%`,
        body,
        tag: "Contenido",
      });
    }
  }

  if (prev?.plays !== undefined && prev.plays > 0) {
    const playsDelta = pct(curr.plays, prev.plays);
    if (Math.abs(playsDelta) >= 25) {
      out.push({
        kind: playsDelta > 0 ? "up" : "down",
        title: `Plays ${playsDelta > 0 ? "+" : ""}${playsDelta.toFixed(0)}%`,
        body: `${curr.plays.toLocaleString("es-ES")} reproducciones vs ${prev.plays.toLocaleString("es-ES")} en el periodo anterior.`,
        tag: "Volumen",
      });
    }
  }

  const lowCrCandidate = topStoriesByMinutes.find(
    (s) => s.listeners >= 5 && s.listenedMinutes > 0
  );
  if (lowCrCandidate) {
    // Nota: completion rate per-story no llega en este payload; usamos
    // listeners >= 5 como señal de "vale revisar manualmente". Cuando
    // la API exponga CR por historia, aquí gateamos por cr < 50.
    out.push({
      kind: "info",
      title: `${lowCrCandidate.storySlug}: revisar dificultad`,
      body: `${lowCrCandidate.listeners} listeners y ${lowCrCandidate.listenedMinutes} min totales. Confirmar que la duración y vocabulario están bien calibrados.`,
      tag: "Editorial",
    });
  }

  if (reminderFunnel.tapRateFromScheduled > 0 && reminderFunnel.tapRateFromScheduled < 25) {
    out.push({
      kind: "warn",
      title: "Recordatorios con poca apertura",
      body: `Solo ${reminderFunnel.tapRateFromScheduled}% de los recordatorios programados generan tap. Iterar copy o timing.`,
      tag: "Reminders",
    });
  }

  if (out.length === 0) {
    out.push({
      kind: "info",
      title: "Datos estables vs periodo anterior",
      body: "No hay movimientos relevantes esta semana. Buen momento para experimentos editoriales o creativos.",
      tag: "Estado",
    });
  }

  return out.slice(0, 4);
}
