import { createHmac, timingSafeEqual } from "crypto";

/**
 * Token para llamadas servidor-a-servidor dentro del mismo deploy (el fetch
 * en background de generate-story hacia /api/audio/generate). Sin el, ese
 * endpoint quedaba abierto y cualquier anonimo podia disparar sintesis de
 * ElevenLabs (gasto real) con un storyId valido. HMAC sobre el storyId con
 * un secreto que solo existe en el servidor; no hay que repartir nada nuevo
 * porque cae en CLERK_SECRET_KEY si INTERNAL_API_SECRET no esta definido.
 */
export const INTERNAL_AUDIO_TOKEN_HEADER = "x-dp-internal-audio-token";

function getInternalSecret(): string {
  const secret =
    process.env.INTERNAL_API_SECRET?.trim() || process.env.CLERK_SECRET_KEY?.trim() || "";
  if (!secret) {
    throw new Error("Missing INTERNAL_API_SECRET or CLERK_SECRET_KEY");
  }
  return secret;
}

export function mintInternalAudioToken(storyId: string): string {
  return createHmac("sha256", getInternalSecret())
    .update(`audio-generate:${storyId}`)
    .digest("hex");
}

export function verifyInternalAudioToken(storyId: string, token: string | null): boolean {
  if (!token) return false;
  const expected = Buffer.from(mintInternalAudioToken(storyId), "utf8");
  const provided = Buffer.from(token, "utf8");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
