import { getConfiguredStandaloneStorySlugs } from "@/lib/standaloneStoryAudioSegments";

function normalizePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const pathname = trimmed.startsWith("http") ? new URL(trimmed).pathname : trimmed.split("?")[0];
    return pathname.trim().toLowerCase();
  } catch {
    return trimmed.split("?")[0].trim().toLowerCase();
  }
}

function getUrlParts(value: string): { pathname: string; searchParams: URLSearchParams } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = trimmed.startsWith("http") ? new URL(trimmed) : new URL(trimmed, "https://example.local");
    return {
      pathname: url.pathname,
      searchParams: url.searchParams,
    };
  } catch {
    return null;
  }
}

function normalizeSlug(value?: string | null): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getStorySource(
  sourcePath?: string | null,
  storySlug?: string | null
): "standalone" | "user" {
  const raw = typeof sourcePath === "string" ? sourcePath.trim() : "";
  if (/\bsource=standalone\b/i.test(raw)) return "standalone";
  if (/\bsource=polyglot\b/i.test(raw)) return "user";

  const slug = normalizeSlug(storySlug);
  if (slug) {
    const standaloneSlugs = new Set(getConfiguredStandaloneStorySlugs());
    if (standaloneSlugs.has(slug)) return "standalone";
  }

  const path = normalizePath(raw);
  if (path.startsWith("/books/")) return "user";

  return "user";
}

export function isStandaloneSourcePath(sourcePath?: string | null, storySlug?: string | null): boolean {
  return getStorySource(sourcePath, storySlug) === "standalone";
}

export function getSegmentIdFromSourcePath(sourcePath?: string | null): string | null {
  if (typeof sourcePath !== "string") return null;
  const parts = getUrlParts(sourcePath);
  const value = parts?.searchParams.get("segmentId")?.trim() ?? "";
  return value || null;
}
