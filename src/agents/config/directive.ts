/**
 * Content Directive; server-only ops (load/save desde DB).
 *
 * Tipos, defaults y sanitizers viven en `./directiveTypes` (puro) para
 * que client components puedan importarlos sin arrastrar prisma al
 * browser. Este archivo concentra las operaciones que tocan DB.
 *
 * Stored en StudioConfig bajo key "content_directive". El pipeline lee
 * esto en cada run.
 */

import {
  DEFAULT_BUDGET,
  DEFAULT_DIRECTIVE,
  DIRECTIVE_CONFIG_KEY,
  sanitizeDirective,
  type ContentDirective,
  type PipelineBudget,
} from "./directiveTypes";

// Re-exportamos puros para que los callers viejos sigan funcionando
// sin tocar imports. Client components deberían importar de
// `./directiveTypes` directo para evitar el server-only barrier.
export {
  DEFAULT_BUDGET,
  DEFAULT_DIRECTIVE,
  DIRECTIVE_CONFIG_KEY,
  sanitizeDirective,
  type ContentDirective,
  type PipelineBudget,
};

const CACHE_TTL = 60_000;

let cached: ContentDirective | null = null;
let cachedAt = 0;

export async function loadDirective(): Promise<ContentDirective> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL) return cached;

  try {
    const { prisma } = await import("@/lib/prisma");
    const row = await (prisma as any).studioConfig.findUnique({
      where: { key: DIRECTIVE_CONFIG_KEY },
    });

    if (row?.value) {
      cached = sanitizeDirective(row.value);
      cachedAt = now;
      return cached;
    }
  } catch {
    // Fall back to defaults
  }

  cached = DEFAULT_DIRECTIVE;
  cachedAt = now;
  return cached;
}

export async function saveDirective(directive: ContentDirective): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const sanitized = sanitizeDirective(directive);

  await (prisma as any).studioConfig.upsert({
    where: { key: DIRECTIVE_CONFIG_KEY },
    create: {
      key: DIRECTIVE_CONFIG_KEY,
      value: sanitized,
      updatedBy: sanitized.updatedBy,
    },
    update: {
      value: sanitized,
      updatedBy: sanitized.updatedBy,
    },
  });

  cached = sanitized;
  cachedAt = Date.now();
}

export function invalidateDirectiveCache() {
  cached = null;
  cachedAt = 0;
}
