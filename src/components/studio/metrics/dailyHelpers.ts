import type { AreaChartDatum } from "./MetricsPrimitives";
import type { DashboardData } from "./types";

/**
 * Returns the AreaChart-ready array from a dashboard response: a row
 * per day with a short label (DD/MM) and the raw plays/completions.
 */
export function toAreaChartData(
  daily: DashboardData["daily"]
): AreaChartDatum[] {
  return daily.map((row) => {
    const [, m, d] = row.date.split("-");
    return {
      date: row.date,
      label: `${d}/${m}`,
      plays: row.plays,
      completions: row.completions,
    };
  });
}

/** Extracts a numeric series (e.g. plays per day) for sparkline use. */
export function sparkSeries(
  daily: DashboardData["daily"],
  key: "plays" | "completions" | "completionRate"
): number[] {
  return daily.map((row) => row[key]);
}

/** Tries to infer a 2-letter language code from a story or book slug. */
export function inferLangFromSlug(slug: string): string | null {
  const lower = slug.toLowerCase();
  if (/-es-|^es-|-es$|spanish/.test(lower)) return "es";
  if (/-it-|^it-|-it$|italian|italiano/.test(lower)) return "it";
  if (/-de-|^de-|-de$|german|deutsch/.test(lower)) return "de";
  if (/-fr-|^fr-|-fr$|french|fran/.test(lower)) return "fr";
  if (/-pt-|^pt-|-pt$|portu/.test(lower)) return "pt";
  if (/-en-|^en-|-en$|english/.test(lower)) return "en";
  return null;
}
