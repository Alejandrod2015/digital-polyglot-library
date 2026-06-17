import "server-only";
import { SPANISH_DIALOGUE_VOICES, GERMAN_DIALOGUE_VOICES } from "@/lib/elevenlabs";

/**
 * Resolves human-readable voice names for the audio editor, so the
 * operator knows WHICH ElevenLabs voice to generate a replacement
 * fragment with. Two sources, in priority order:
 *
 *   1. The live ElevenLabs account (`GET /v1/voices`) — the real name as
 *      it appears in ElevenLabs (what the operator searches for). Cached
 *      in-memory for a few minutes so we don't refetch per request.
 *   2. Our canonical dialogue catalog slot names (angela, horacio, …) —
 *      a fallback for voices not (yet) in the account listing.
 *
 * Voice IDs are normalized by stripping an optional "elevenlabs/" prefix
 * (dialogueSpec stores either form).
 */

export function stripVoicePrefix(voiceId: string | null | undefined): string {
  if (!voiceId) return "";
  return voiceId.startsWith("elevenlabs/") ? voiceId.slice("elevenlabs/".length) : voiceId;
}

// id → catalog slot name, built once from the canonical dialogue maps.
const CATALOG_NAME_BY_ID: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [slot, id] of Object.entries(SPANISH_DIALOGUE_VOICES)) map[id] = slot;
  for (const [slot, id] of Object.entries(GERMAN_DIALOGUE_VOICES)) map[id] = slot;
  return map;
})();

type ElevenVoice = { voice_id: string; name?: string };
let cache: { at: number; byId: Record<string, string> } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchElevenLabsNames(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.byId;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return {};
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
      // GET listing only — never synthesis. Read-only, no credits.
      cache: "no-store",
    });
    if (!res.ok) return cache?.byId ?? {};
    const data = (await res.json()) as { voices?: ElevenVoice[] };
    const byId: Record<string, string> = {};
    for (const v of data.voices ?? []) {
      if (v.voice_id && v.name) byId[v.voice_id] = v.name;
    }
    cache = { at: Date.now(), byId };
    return byId;
  } catch {
    return cache?.byId ?? {};
  }
}

export type ResolvedVoice = { voiceId: string; voiceName: string | null };

/**
 * Resolve a map of normalized-voiceId → friendly name for the given IDs.
 * Returns the ElevenLabs account name when available, else the catalog
 * slot name, else null (UI shows just the ID).
 */
export async function resolveVoiceNames(rawIds: Array<string | null | undefined>): Promise<Map<string, string | null>> {
  const ids = Array.from(new Set(rawIds.map(stripVoicePrefix).filter(Boolean)));
  const elevenNames = await fetchElevenLabsNames();
  const out = new Map<string, string | null>();
  for (const id of ids) {
    out.set(id, elevenNames[id] ?? CATALOG_NAME_BY_ID[id] ?? null);
  }
  return out;
}
