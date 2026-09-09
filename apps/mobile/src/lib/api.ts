import { Platform } from "react-native";

/**
 * Cada llamada dice desde qué sistema sale. El servidor lo sellaba como "ios"
 * a mano, así que un usuario de Android aparecía en las métricas como si
 * tuviera un iPhone. Es un dato que sólo el cliente conoce, y va aquí para que
 * lo lleven todas las llamadas y no haya que acordarse en cada una.
 */
export const CLIENT_PLATFORM_HEADER = "X-DP-Platform";
export const clientPlatform: "ios" | "android" =
  Platform.OS === "android" ? "android" : "ios";

/**
 * Y cuál es el aparato. El modelo sólo se guardaba cuando alguien abría la
 * hoja de feedback, que casi nadie abre: con una captura del lector roto no
 * había forma de saber en qué teléfono pasaba. Estas tres cabeceras viajan en
 * TODA llamada y el servidor las guarda por persona, así que el dato está sin
 * preguntárselo a nadie.
 *
 * Se calculan una vez al cargar el módulo: son constantes durante la vida del
 * proceso y no vale la pena tocar los módulos nativos en cada petición.
 * `expo-device` y `expo-application` van en require perezoso porque no siempre
 * están enlazados (Expo Go, un binario viejo) y su ausencia NO puede tumbar
 * una llamada a la API.
 */
export const DEVICE_HEADER = "X-DP-Device";
export const OS_HEADER = "X-DP-OS";
export const APP_HEADER = "X-DP-App";

function readClientDevice(): { device: string; os: string; app: string } {
  let device = "";
  let os = "";
  let app = "";
  try {
    const Device = require("expo-device");
    device = Device?.modelName?.trim() ?? "";
    const osName = Device?.osName?.trim() || (Platform.OS === "android" ? "Android" : "iOS");
    const osVersion = Device?.osVersion?.trim() ?? "";
    os = osVersion ? `${osName} ${osVersion}` : "";
  } catch {
    // Sin expo-device: se manda vacío y el servidor guarda la fila igual.
  }
  try {
    const Application = require("expo-application");
    const version = Application?.nativeApplicationVersion?.trim() ?? "";
    const build = Application?.nativeBuildVersion?.trim() ?? "";
    app = version && build ? `${version} (${build})` : version || build;
  } catch {
    // idem
  }
  return { device, os, app };
}

const clientDevice = readClientDevice();

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
          [CLIENT_PLATFORM_HEADER]: clientPlatform,
          ...(clientDevice.device ? { [DEVICE_HEADER]: clientDevice.device } : {}),
          ...(clientDevice.os ? { [OS_HEADER]: clientDevice.os } : {}),
          ...(clientDevice.app ? { [APP_HEADER]: clientDevice.app } : {}),
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
