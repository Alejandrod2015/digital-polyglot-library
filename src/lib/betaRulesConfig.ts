// Persistence for the beta triage config. Split out of betaRules.ts so that
// the scoring engine itself stays importable without a database: it claims to
// be pure, and a module that pulls in prisma (and through it `server-only`)
// cannot be exercised from a script or a test.

import { prisma } from "@/lib/prisma";
import { DEFAULT_BETA_RULES, type BetaRulesConfig } from "@/lib/betaRules";

export const BETA_RULES_CONFIG_KEY = "beta_rules_v1";

export async function getBetaRules(): Promise<BetaRulesConfig> {
  try {
    const row = await prisma.studioConfig.findUnique({ where: { key: BETA_RULES_CONFIG_KEY } });
    if (!row) return DEFAULT_BETA_RULES;
    const stored = row.value as Partial<BetaRulesConfig> | null;
    if (!stored || typeof stored !== "object") return DEFAULT_BETA_RULES;
    // Merge rather than replace: a config row written before a field existed
    // must not knock that field back to undefined.
    return { ...DEFAULT_BETA_RULES, ...stored };
  } catch {
    // A config read failure must not take the public form down with it.
    return DEFAULT_BETA_RULES;
  }
}

export async function saveBetaRules(
  patch: Partial<BetaRulesConfig>,
  updatedBy: string,
): Promise<BetaRulesConfig> {
  const merged = { ...(await getBetaRules()), ...patch };
  await prisma.studioConfig.upsert({
    where: { key: BETA_RULES_CONFIG_KEY },
    create: { key: BETA_RULES_CONFIG_KEY, value: merged, updatedBy },
    update: { value: merged, updatedBy },
  });
  return merged;
}
