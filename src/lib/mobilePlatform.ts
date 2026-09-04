import type { NextRequest } from "next/server";

/**
 * De qué sistema viene una llamada de la app. El cliente lo manda en la
 * cabecera `X-DP-Platform`; las versiones anteriores a que existiera no la
 * mandan, y ésas son iPhone por construcción (la beta de Android llegó
 * después), así que ese es el valor por defecto.
 *
 * Antes esto no se preguntaba: el servidor escribía "ios" a mano en el sello
 * de la cuenta y en cada evento, de modo que un usuario de Android salía en
 * las métricas con un iPhone que no tiene.
 */
export type MobilePlatform = "ios" | "android";

export function mobilePlatformFromRequest(req: NextRequest): MobilePlatform {
  const raw = req.headers.get("x-dp-platform")?.trim().toLowerCase();
  return raw === "android" ? "android" : "ios";
}

/**
 * El sistema del dispositivo que registró notificaciones, leído del propio
 * token. Cada registro guarda `platform` (de `Platform.OS`) y `provider`
 * (`apns` en iPhone, `native` en Android) desde marzo de 2026, así que este
 * dato existe para cualquiera que haya abierto la app, sin depender de la
 * cabecera que sólo mandan las versiones nuevas.
 *
 * Las métricas contaban los tokens y tiraban el campo, y luego el respaldo
 * escribía "ios" a mano: quien leyó desde un Android antes de la build del 30
 * de agosto salía con un iPhone que no tiene. Aquí gana el registro más
 * reciente, que es el teléfono en el que esa persona está de verdad.
 */
export function pushTokenPlatform(privateMetadata: unknown): MobilePlatform | null {
  const meta =
    privateMetadata && typeof privateMetadata === "object"
      ? (privateMetadata as Record<string, unknown>)
      : null;
  const tokens = Array.isArray(meta?.mobilePushTokens) ? meta.mobilePushTokens : [];

  let best: { platform: MobilePlatform; updatedAt: number } | null = null;

  for (const item of tokens) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;

    // `platform` es la respuesta directa. `provider` es el respaldo para
    // registros viejos que no la guardaban: lo elige la propia app según el
    // sistema, así que dice lo mismo por otra vía.
    const raw = typeof record.platform === "string" ? record.platform.trim().toLowerCase() : "";
    const provider = typeof record.provider === "string" ? record.provider.trim().toLowerCase() : "";
    const platform: MobilePlatform | null =
      raw === "android" || raw === "ios"
        ? raw
        : provider === "apns"
          ? "ios"
          : provider === "native" || provider === "fcm"
            ? "android"
            : null;
    if (!platform) continue;

    // El orden del array es "el último registro primero" en el momento de
    // escribirlo, pero la fecha lo dice sin depender de eso.
    const parsed = typeof record.updatedAt === "string" ? Date.parse(record.updatedAt) : NaN;
    const updatedAt = Number.isNaN(parsed) ? 0 : parsed;
    if (!best || updatedAt > best.updatedAt) best = { platform, updatedAt };
  }

  return best?.platform ?? null;
}
