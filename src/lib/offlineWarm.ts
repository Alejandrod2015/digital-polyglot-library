function normalizeCacheUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  try {
    return new URL(raw, window.location.origin).toString();
  } catch {
    return null;
  }
}

export async function warmOfflineUrls(urls: Array<string | null | undefined>) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const normalized = Array.from(
    new Set(
      urls
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalizeCacheUrl(value))
        .filter((value): value is string => Boolean(value))
    )
  );

  if (normalized.length === 0) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({
      type: "CACHE_URLS",
      urls: normalized,
    });
  } catch {
    // ignore warmup failures
  }
}
