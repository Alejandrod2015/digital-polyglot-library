function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getPublicMediaBaseUrl(): string {
  const value =
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? ""
      : process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "";

  return trimTrailingSlash(value.trim());
}

function withBaseUrl(path: string): string {
  const baseUrl = getPublicMediaBaseUrl();
  if (!baseUrl || !path.startsWith("/")) return path;
  return `${baseUrl}${path}`;
}

function getBasename(value: string): string {
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new URL(value).pathname.split("/").pop() ?? "";
    }
  } catch {
    return "";
  }

  return value.split("/").pop() ?? "";
}

export function isSanityAssetUrl(value: string): boolean {
  return value.startsWith("https://cdn.sanity.io/");
}

export function shouldBypassImageOptimization(value?: string | null): boolean {
  const resolved = typeof value === "string" ? value.trim() : "";
  if (!resolved) return false;

  return (
    resolved.startsWith("http://") ||
    resolved.startsWith("https://") ||
    resolved.startsWith("//")
  );
}

export function resolvePublicMediaUrl(raw?: string | null): string | undefined {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return undefined;

  if (value.startsWith("/")) {
    return withBaseUrl(value);
  }

  return value;
}

export function resolveCatalogImageUrl(raw?: string | null): string | undefined {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return undefined;
  if (value.startsWith("/")) return withBaseUrl(value);

  const filename = getBasename(value);
  if (!filename) return undefined;
  return withBaseUrl(`/media/catalog/images/${filename}`);
}

export function resolveCatalogAudioUrl(raw?: string | null): string | undefined {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return undefined;
  if (value.startsWith("/")) return withBaseUrl(value);

  const filename = getBasename(value);
  if (filename) {
    return withBaseUrl(`/media/catalog/audio/${filename}`);
  }

  const normalized = value.replace(/^\/+/, "");
  if (!normalized) return undefined;
  const withExtension = normalized.endsWith(".mp3") ? normalized : `${normalized}.mp3`;
  return withBaseUrl(`/media/catalog/audio/${withExtension}`);
}
