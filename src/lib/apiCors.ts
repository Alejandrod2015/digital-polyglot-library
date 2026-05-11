// Permissive CORS headers for internal API endpoints that used to be hit
// by the legacy Sanity Studio mount. After the Sanity cutover these are
// only called from the same-origin Studio Next.js, but the headers stay
// in case external tooling consumes them.

const HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export function buildApiCorsHeaders(_origin: string | null): Record<string, string> {
  return HEADERS;
}
