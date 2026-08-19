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
