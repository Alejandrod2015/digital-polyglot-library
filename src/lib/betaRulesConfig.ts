// Persistence for the beta triage config. Split out of betaRules.ts so that
// the scoring engine itself stays importable without a database: it claims to
// be pure, and a module that pulls in prisma (and through it `server-only`)
// cannot be exercised from a script or a test.

import { prisma } from "@/lib/prisma";
import { DEFAULT_BETA_RULES, type BetaRulesConfig } from "@/lib/betaRules";

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
  return { ...rules, acceptedTargetLanguages: derived };
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
