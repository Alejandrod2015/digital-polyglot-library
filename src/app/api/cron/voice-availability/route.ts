// /api/cron/voice-availability
//
// Daily check that every ElevenLabs voice in our production cast is
// still available in the Voice Library. Triggered by Vercel cron
// (see vercel.json) and callable manually.
//
// Why this exists:
//   Voice actors can retire their shared voices. ElevenLabs sends an
//   email + in-app notification when that happens, with a notice
//   period (180 days or 730 days) during which the model still works
//   and any audio already generated continues to live forever (per
//   the Voice Library Addendum: "Outputs generated using your User
//   Voice Model prior to the end of the Notice Period will continue
//   to exist and remain available for use thereafter"). So a retired
//   voice ONLY breaks future story generation, never existing audio.
//
//   This cron is the second safety net under that email: if a voice
//   transitions to "notice period initiated" or returns 404, we want
//   to know within 24h so we can pick a replacement and update the
//   cast in `src/lib/elevenlabs.ts` before any new story is generated
//   with a doomed voice.
//
// What it checks per voice:
//   - Voice id resolves (no 404) → still in our account
//   - `notice_period_initiated_at` is null → owner hasn't started retire
//   - `enabled_in_library` is true (or null for premade) → still public
//
// Returns 200 + ok:true when all voices are healthy. Returns 500 +
// ok:false on the first failure so Vercel cron logs surface it.

import { NextResponse } from "next/server";
import { GERMAN_DIALOGUE_VOICES } from "@/lib/elevenlabs";

type VoiceCheck = {
  id: string;
  label: string;
  ok: boolean;
  status: "ok" | "missing" | "notice_started" | "disabled" | "error";
  detail?: string;
  noticePeriodDays?: number | null;
};

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

async function checkVoice(id: string, label: string): Promise<VoiceCheck> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return { id, label, ok: false, status: "error", detail: "ELEVENLABS_API_KEY missing" };
  }
  try {
    const resp = await fetch(`${ELEVENLABS_API}/voices/${id}`, {
      headers: { "xi-api-key": apiKey },
    });
    if (resp.status === 404) {
      return { id, label, ok: false, status: "missing", detail: "voice 404; fully retired or revoked" };
    }
    if (!resp.ok) {
      return { id, label, ok: false, status: "error", detail: `HTTP ${resp.status}` };
    }
    const data = (await resp.json()) as {
      sharing?: {
        notice_period?: number | null;
        notice_period_initiated_at?: number | null;
        enabled_in_library?: boolean | null;
      } | null;
      category?: string;
    };
    const sharing = data.sharing ?? null;
    const noticePeriodDays = sharing?.notice_period ?? null;
    const noticeStarted = sharing?.notice_period_initiated_at ?? null;
    const enabledInLibrary = sharing?.enabled_in_library;

    if (noticeStarted) {
      const startedAt = new Date(noticeStarted * 1000);
      const days = noticePeriodDays ?? 0;
      const endsAt = new Date(startedAt.getTime() + days * 86400_000);
      const daysLeft = Math.ceil((endsAt.getTime() - Date.now()) / 86400_000);
      return {
        id,
        label,
        ok: false,
        status: "notice_started",
        detail: `notice started ${startedAt.toISOString().slice(0, 10)}; ${daysLeft} days left; migrate before ${endsAt.toISOString().slice(0, 10)}`,
        noticePeriodDays,
      };
    }
    if (enabledInLibrary === false && data.category === "professional") {
      // Pro shared voices typically show enabled_in_library=false even
      // when fully working for accounts that already added them, so
      // this isn't always a retirement signal. Log but don't fail.
      return {
        id,
        label,
        ok: true,
        status: "ok",
        detail: `enabled_in_library=false (normal for added pro voices); notice_period=${noticePeriodDays} days`,
        noticePeriodDays,
      };
    }
    return {
      id,
      label,
      ok: true,
      status: "ok",
      detail: `category=${data.category ?? "?"}; notice_period=${noticePeriodDays ?? "perpetual"}`,
      noticePeriodDays,
    };
  } catch (err) {
    return { id, label, ok: false, status: "error", detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET() {
  const cast: Array<[label: string, id: string]> = Object.entries(
    GERMAN_DIALOGUE_VOICES as Record<string, string>
  );
  const results = await Promise.all(cast.map(([label, id]) => checkVoice(id, label)));
  const failures = results.filter((r) => !r.ok);
  const status = failures.length === 0 ? 200 : 500;
  return NextResponse.json(
    {
      ok: failures.length === 0,
      checkedAt: new Date().toISOString(),
      voices: results,
      failures: failures.length,
    },
    { status },
  );
}
