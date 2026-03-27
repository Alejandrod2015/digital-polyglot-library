export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isApiErrorStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

function buildFallbackBaseUrls(baseUrl: string): string[] {
  try {
    const parsed = new URL(baseUrl);
    const isLocalHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    if (!isLocalHost) return [baseUrl];

    const preferredPort = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    const candidatePorts = [preferredPort, "3000", "3001", "3002", "3003"];
    const uniquePorts = Array.from(new Set(candidatePorts.filter(Boolean)));

    return uniquePorts.map((port) => {
      const next = new URL(parsed.toString());
      next.port = port;
      if (next.hostname === "localhost") next.hostname = "127.0.0.1";
      return next.toString().replace(/\/$/, "");
    });
  } catch {
    return [baseUrl];
  }
}

export async function apiFetch<T>(args: {
  baseUrl: string;
  path: string;
  token?: string | null;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
}): Promise<T> {
  const { baseUrl, path, token, method = "GET", body, timeoutMs = 10000 } = args;
  const candidateBaseUrls = buildFallbackBaseUrls(baseUrl);
  let lastError: unknown = null;

  for (const candidateBaseUrl of candidateBaseUrls) {
    const url = new URL(path, candidateBaseUrl).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;

      if (!response.ok) {
        const errorMessage =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : `Request failed with status ${response.status}`;
        throw new ApiError(errorMessage, response.status);
      }

      return payload as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error(`Request timed out for ${path}`);
      } else {
        lastError = error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Request failed for ${path}`);
}
