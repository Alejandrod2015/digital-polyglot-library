import { mobileConfig } from "../config";

// Next.js `/_next/image` only accepts widths from the configured device/image
// size arrays. Snap any requested width up to the closest allowed value so the
// optimizer actually serves a transformed WebP instead of a 400 error.
const ALLOWED_COVER_WIDTHS = [128, 256, 384, 640, 750, 828, 1080, 1200, 1920];

function snapCoverWidth(requested: number): number {
  const target = Math.max(0, Math.round(requested));
  for (const w of ALLOWED_COVER_WIDTHS) {
    if (w >= target) return w;
  }
  return ALLOWED_COVER_WIDTHS[ALLOWED_COVER_WIDTHS.length - 1]!;
}

/**
 * Produce an optimized cover URL for mobile rendering.
 *
 * - Sanity URLs get Sanity's own CDN transform params (`w`, `q`, `auto=format`).
 * - Everything else (R2, our CDN, arbitrary HTTPS) is proxied through the
 *   Next.js `/_next/image` endpoint so we receive ~50 KB WebPs instead of
 *   multi-megabyte PNGs. This is the single biggest win for cover load times.
 * - Missing/empty input falls back to the default local cover asset.
 */
export function getCoverUrl(input?: string | null, width = 400): string {
  if (typeof input !== "string" || !input.trim()) {
    return "https://reader.digitalpolyglot.com/covers/default.jpg";
  }
  if (input.includes("cdn.sanity.io/images/")) {
    const sep = input.includes("?") ? "&" : "?";
    return `${input}${sep}w=${width}&q=75&auto=format&fit=max`;
  }
  if (/^https?:\/\//i.test(input)) {
    // If the URL was already routed through /_next/image, don't double-wrap.
    if (input.includes("/_next/image?")) return input;
    const snapped = snapCoverWidth(width);
    const encoded = encodeURIComponent(input);
    const base = mobileConfig.apiBaseUrl.replace(/\/+$/, "");
    return `${base}/_next/image?url=${encoded}&w=${snapped}&q=75`;
  }
  return input;
}
