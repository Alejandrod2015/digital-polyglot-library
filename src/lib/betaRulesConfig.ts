// Persistence for the beta triage config. Split out of betaRules.ts so that
// the scoring engine itself stays importable without a database: it claims to
// be pure, and a module that pulls in prisma (and through it `server-only`)
// cannot be exercised from a script or a test.

import { prisma } from "@/lib/prisma";
import { DEFAULT_BETA_RULES, type BetaRulesConfig } from "@/lib/betaRules";
import { variantPool } from "@domain/languageVariant";
import { broadLevelFromCefr } from "@domain/cefr";

export const BETA_RULES_CONFIG_KEY = "beta_rules_v1";

/**
 * Languages with at least one PUBLISHED journey, spelled the way the signup
 * form spells them ("portuguese" in the journey row, "Portuguese" in the
 * application), so the triage engine can compare them without knowing that
 * these two tables disagree about capitalisation.
 *
 * Published only, on purpose: a draft journey is not something a tester can be
 * handed, so a language that only exists as a draft is not one we can recruit
 * for yet.
 */
export async function deriveAcceptedLanguages(): Promise<string[]> {
  const rows = await prisma.journey.findMany({
    where: { status: "active" },
    select: { language: true },
    distinct: ["language"],
  });
  return rows
    .map((r) => r.language.trim())
    .filter(Boolean)
    .map((l) => l.charAt(0).toUpperCase() + l.slice(1).toLowerCase())
    .sort((a, b) => a.localeCompare(b));
}

export async function getBetaRules(): Promise<BetaRulesConfig> {
  try {
    const row = await prisma.studioConfig.findUnique({ where: { key: BETA_RULES_CONFIG_KEY } });
    if (!row) return DEFAULT_BETA_RULES;
    const stored = row.value as Partial<BetaRulesConfig> | null;
    if (!stored || typeof stored !== "object") return DEFAULT_BETA_RULES;
    // Merge rather than replace: a config row written before a field existed
    // must not knock that field back to undefined.
    const merged = { ...DEFAULT_BETA_RULES, ...stored };
    return merged.acceptedLanguagesMode === "manual" ? merged : await withDerivedLanguages(merged);
  } catch {
    // A config read failure must not take the public form down with it.
    return DEFAULT_BETA_RULES;
  }
}

/**
 * Swap in the derived recruiting list, keeping the stored one if the query
 * comes back empty: no published journey at all is far likelier to mean a
 * broken read than a beta that recruits nobody, and the wrong way to be wrong
 * here is to decline every applicant in sight.
 */
async function withDerivedLanguages(rules: BetaRulesConfig): Promise<BetaRulesConfig> {
  const derived = await deriveAcceptedLanguages();
  if (derived.length === 0) return rules;
  const [pools, niveles] = await Promise.all([
    deriveAcceptedVariantPools(),
    deriveAcceptedLevels(),
  ]);
  return {
    ...rules,
    acceptedTargetLanguages: derived,
    acceptedVariantPools: pools,
    acceptedLevelsByVariant: niveles.porVariante,
    acceptedLevelsByPool: niveles.porPool,
  };
}

/**
 * Content pools with a PUBLISHED journey, so the triage can tell "Portuguese"
 * (recruiting) from "Portuguese for Portugal" (nothing to hand over while only
 * Brazil is live). A journey whose variant we do not model is skipped rather
 * than invented; that only loosens the gate, never tightens it.
 */
export async function deriveAcceptedVariantPools(): Promise<string[]> {
  const rows = await prisma.journey.findMany({
    where: { status: "active" },
    select: { variant: true },
    distinct: ["variant"],
  });
  const pools = new Set<string>();
  for (const r of rows) {
    const pool = variantPool(r.variant);
    if (pool) pools.add(pool);
  }
  return [...pools].sort();
}

/**
 * Las bandas de nivel publicadas, por variante exacta y por pool.
 *
 * `Journey.levels` guarda codigos CEFR (a0..c2) y el formulario de beta
 * pregunta por banda ancha (Beginner / Intermediate / Advanced), asi que la
 * traduccion pasa por `broadLevelFromCefr` y no por una tabla propia: hay
 * tres mapas distintos en el repo y este tiene que ser el mismo que usa el
 * lector.
 *
 * Solo publicados, por lo mismo que las otras dos listas: un borrador no es
 * algo que se le pueda dar a un tester.
 */
export async function deriveAcceptedLevels(): Promise<{
  porVariante: Record<string, string[]>;
  porPool: Record<string, string[]>;
}> {
  const rows = await prisma.journey.findMany({
    where: { status: "active" },
    select: { variant: true, levels: true },
  });
  const porVariante: Record<string, Set<string>> = {};
  const porPool: Record<string, Set<string>> = {};
  for (const row of rows) {
    const variante = (row.variant ?? "").trim().toLowerCase();
    const pool = variantPool(row.variant);
    for (const nivel of row.levels ?? []) {
      const banda = broadLevelFromCefr(nivel);
      if (!banda) continue;
      if (variante) (porVariante[variante] ??= new Set()).add(banda);
      if (pool) (porPool[pool] ??= new Set()).add(banda);
    }
  }
  const aplanar = (m: Record<string, Set<string>>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v].sort()]));
  return { porVariante: aplanar(porVariante), porPool: aplanar(porPool) };
}

export async function saveBetaRules(
  patch: Partial<BetaRulesConfig>,
  updatedBy: string,
): Promise<BetaRulesConfig> {
  // Read the RAW row, not getBetaRules(): in auto mode that one hands back the
  // derived list, and writing it would quietly bake today's published set into
  // the stored fallback every time anyone saved an unrelated threshold.
  const row = await prisma.studioConfig.findUnique({ where: { key: BETA_RULES_CONFIG_KEY } });
  const stored = (row?.value as Partial<BetaRulesConfig> | null) ?? null;
  const base = stored && typeof stored === "object" ? { ...DEFAULT_BETA_RULES, ...stored } : DEFAULT_BETA_RULES;
  const merged = { ...base, ...patch };
  await prisma.studioConfig.upsert({
    where: { key: BETA_RULES_CONFIG_KEY },
    create: { key: BETA_RULES_CONFIG_KEY, value: merged, updatedBy },
    update: { value: merged, updatedBy },
  });
  return merged;
}
