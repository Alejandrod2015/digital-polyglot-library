"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  ChevronUp,
} from "lucide-react";
import { resolveCatalogAudioUrl, resolvePublicMediaUrl } from "@/lib/publicMedia";
import { trackGa4Event } from "@/lib/ga4";

const TRACKED_PLAYER_EVENTS = new Set([
  "audio_play",
  "audio_pause",
  "audio_complete",
]);

const CONTINUE_SYNC_INTERVAL_MS = 60_000;
const MIN_PROGRESS_PERSIST_DELTA_SEC = 20;

async function trackMetric(
  storySlug: string,
  bookSlug: string,
  eventType: string,
  value?: number,
  metadata?: Record<string, unknown>
) {
  if (!TRACKED_PLAYER_EVENTS.has(eventType)) return;
  try {
    await fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storySlug, bookSlug, eventType, value, metadata }),
    });
  } catch {
    // silencioso
  }
}

function buildContinueMetricMetadata(progressSec?: number, audioDurationSec?: number) {
  return {
    ...(typeof progressSec === "number" && Number.isFinite(progressSec)
      ? { progressSec: Math.max(0, Math.round(progressSec)) }
      : {}),
    ...(typeof audioDurationSec === "number" && Number.isFinite(audioDurationSec)
      ? { audioDurationSec: Math.max(0, Math.round(audioDurationSec)) }
      : {}),
  };
}

async function syncContinueListening(
  storySlug: string,
  bookSlug: string,
  progressSec?: number,
  audioDurationSec?: number
) {
  if (bookSlug === "polyglot") return;
  try {
    await fetch("/api/continue-listening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storySlug, bookSlug, progressSec, audioDurationSec }),
    });
  } catch {
    // silencioso
  }
}

function syncContinueListeningBeacon(
  storySlug: string,
  bookSlug: string,
  progressSec?: number,
  audioDurationSec?: number
) {
  if (bookSlug === "polyglot") return;
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
  try {
    const payload = JSON.stringify({
      storySlug,
      bookSlug,
      progressSec,
      audioDurationSec,
    });
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/continue-listening", blob);
  } catch {
    // silencioso
  }
}

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
  removeEventListener: (type: "release", listener: () => void) => void;
};
type NavigatorWithWakeLock = Navigator & {
  wakeLock: { request: (type: "screen") => Promise<WakeLockSentinel> };
};
function getWakeLockNavigator(): NavigatorWithWakeLock | null {
  if (typeof navigator === "undefined") return null;
  return "wakeLock" in navigator
    ? (navigator as NavigatorWithWakeLock)
    : null;
}

interface PlayerProps {
  src: string;
  bookSlug: string;
  storySlug: string;
  canPlay?: boolean;
  prevStorySlug?: string | null;
  nextStorySlug?: string | null;
  continueMeta?: {
    title: string;
    bookTitle: string;
    cover?: string;
    language?: string;
    level?: string;
    topic?: string;
    readMinutes?: number;
  };
}

// Static pseudo-random bar heights for the waveform (deterministic so they
// don't flicker between renders). Fast variation + a slow swell for an organic,
// real-audio look. 0.18..1.0 of the track height.
const WAVEFORM_BARS = Array.from({ length: 90 }, (_, i) => {
  const a = Math.abs(Math.sin((i + 1) * 12.9898) * 43758.5453);
  const fast = a - Math.floor(a); // 0..1 jitter
  const slow = (Math.sin((i + 1) * 0.5) + 1) / 2; // 0..1 swell
  return Math.min(1, 0.18 + fast * 0.62 + slow * 0.2);
});

export default function Player({
  src,
  bookSlug,
  storySlug,
  canPlay = true,
  prevStorySlug = null,
  nextStorySlug = null,
  continueMeta,
}: PlayerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sleepEndsAt] = useState<number | null>(null);
  const loopA: number | null = null;
  const loopB: number | null = null;

  useEffect(() => {
    if (loopA === null || loopB === null) return;
    if (loopB <= loopA) return;
    const audio = audioRef.current;
    if (!audio) return;
    const handler = () => {
      if (audio.currentTime >= loopB) {
        audio.currentTime = loopA;
      }
    };
    audio.addEventListener("timeupdate", handler);
    return () => audio.removeEventListener("timeupdate", handler);
  }, [loopA, loopB]);

  // Sleep timer y A-B loop removidos: nunca se pidieron y agregaban
  // botones que la trabajadora no entendía. Player ahora se limita a
  // play/pause, skip, speed.
  void sleepEndsAt;
  void loopA;
  void loopB;

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastPersistedProgressRef = useRef<number | null>(null);
  const navWL = getWakeLockNavigator();

  const requestWakeLock = async () => {
    try {
      if (!navWL) return;
      if (wakeLockRef.current) return;
      wakeLockRef.current = await navWL.wakeLock.request("screen");
      const onRelease = () => (wakeLockRef.current = null);
      wakeLockRef.current.addEventListener("release", onRelease);
    } catch {
      // ignorar
    }
  };

  const releaseWakeLock = async () => {
    try {
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        await wakeLockRef.current.release();
      }
    } catch {
      // ignorar
    } finally {
      wakeLockRef.current = null;
    }
  };

  const resolvedSrc = useMemo(() => {
    const normalized = typeof src === "string" ? src.trim() : "";
    if (!normalized) return "";
    if (normalized.startsWith("http") || normalized.startsWith("/")) {
      return resolvePublicMediaUrl(normalized) ?? "";
    }
    return resolveCatalogAudioUrl(normalized) ?? "";
  }, [src]);
  const hasPlayableAudio = resolvedSrc.length > 0;

  const canTrackContinueListening = Boolean(continueMeta);
  const navigationSuffix = useMemo(() => {
    const params = new URLSearchParams();
    const returnTo = searchParams.get("returnTo");
    const returnLabel = searchParams.get("returnLabel");
    const from = searchParams.get("from");

    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      params.set("returnTo", returnTo);
      if (returnLabel?.trim()) params.set("returnLabel", returnLabel.trim());
    } else if (from?.trim()) {
      params.set("from", from.trim());
    }

    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [searchParams]);

  const rememberContinueListening = useCallback((overrideProgressSec?: number) => {
    if (!hasPlayableAudio) return;
    if (!continueMeta) return;
    if (typeof window === "undefined") return;

    const key = "dp_continue_listening_v1";
    const cover =
      typeof continueMeta.cover === "string" && continueMeta.cover.trim() !== ""
        ? continueMeta.cover
        : "/covers/default.jpg";
    const liveProgress = audioRef.current?.currentTime;
    const resolvedProgress =
      Number.isFinite(overrideProgressSec)
        ? (overrideProgressSec as number)
        : Number.isFinite(liveProgress)
          ? (liveProgress as number)
          : 0;

    const current = {
      bookSlug,
      storySlug,
      title: continueMeta.title,
      bookTitle: continueMeta.bookTitle,
      cover,
      language: continueMeta.language,
      level: continueMeta.level,
      topic: continueMeta.topic,
      readMinutes:
        typeof continueMeta.readMinutes === "number" && Number.isFinite(continueMeta.readMinutes)
          ? continueMeta.readMinutes
          : undefined,
      audioDurationSec:
        Number.isFinite(duration) && duration > 0 ? Math.round(duration) : undefined,
      progressSec:
        Number.isFinite(resolvedProgress)
          ? Math.max(0, Math.round(resolvedProgress))
          : 0,
    };

    try {
      const raw = window.localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? parsed : [];

      const safe = list.filter(
        (i): i is {
          bookSlug: string;
          storySlug: string;
          title: string;
          bookTitle: string;
          cover: string;
          language?: string;
          level?: string;
          topic?: string;
          readMinutes?: number;
          audioDurationSec?: number;
          progressSec?: number;
        } => {
        if (typeof i !== "object" || i === null) return false;
        const r = i as Record<string, unknown>;
        return (
          typeof r.bookSlug === "string" &&
          typeof r.storySlug === "string" &&
          typeof r.title === "string" &&
          typeof r.bookTitle === "string" &&
          typeof r.cover === "string"
        );
      }
      );

      const deduped = safe.filter(
        (i) => !(i.bookSlug === current.bookSlug && i.storySlug === current.storySlug)
      );
      const next = [current, ...deduped].slice(0, 8);
      window.localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(
        new CustomEvent("continue-listening-updated", {
          detail: {
            bookSlug: current.bookSlug,
            storySlug: current.storySlug,
            progressSec: current.progressSec,
            audioDurationSec: current.audioDurationSec,
          },
        })
      );
    } catch {
      // silencioso
    }
  }, [bookSlug, continueMeta, duration, hasPlayableAudio, storySlug]);

  const shouldPersistProgress = useCallback((progressSec?: number) => {
    if (typeof progressSec !== "number" || !Number.isFinite(progressSec) || progressSec < 0) {
      return false;
    }

    const rounded = Math.max(0, Math.round(progressSec));
    const previous = lastPersistedProgressRef.current;
    if (previous === null || Math.abs(rounded - previous) >= MIN_PROGRESS_PERSIST_DELTA_SEC) {
      lastPersistedProgressRef.current = rounded;
      return true;
    }

    return false;
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (continueMeta) {
      try {
        ms.metadata = new MediaMetadata({
          title: continueMeta.title,
          artist: continueMeta.bookTitle,
          album: continueMeta.language ?? undefined,
          artwork: continueMeta.cover
            ? [
                { src: continueMeta.cover, sizes: "256x256", type: "image/png" },
                { src: continueMeta.cover, sizes: "512x512", type: "image/png" },
              ]
            : undefined,
        });
      } catch {
        // MediaMetadata not supported in this browser.
      }
    }

    const handlerPlay = () => {
      audioRef.current?.play().catch(() => {});
      setIsPlaying(true);
    };
    const handlerPause = () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    };
    const handlerSeekBack = () => {
      if (!audioRef.current) return;
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15);
    };
    const handlerSeekForward = () => {
      if (!audioRef.current) return;
      audioRef.current.currentTime = Math.min(
        audioRef.current.duration || Infinity,
        audioRef.current.currentTime + 15
      );
    };
    const handlerPrev = prevStorySlug
      ? () => {
          router.push(`/books/${bookSlug}/${prevStorySlug}${navigationSuffix}`);
        }
      : null;
    const handlerNext = nextStorySlug
      ? () => {
          router.push(`/books/${bookSlug}/${nextStorySlug}${navigationSuffix}`);
        }
      : null;

    try {
      ms.setActionHandler("play", handlerPlay);
      ms.setActionHandler("pause", handlerPause);
      ms.setActionHandler("seekbackward", handlerSeekBack);
      ms.setActionHandler("seekforward", handlerSeekForward);
      ms.setActionHandler("previoustrack", handlerPrev);
      ms.setActionHandler("nexttrack", handlerNext);
    } catch {
      // Some Action types may not be supported.
    }

    return () => {
      try {
        ms.setActionHandler("play", null);
        ms.setActionHandler("pause", null);
        ms.setActionHandler("seekbackward", null);
        ms.setActionHandler("seekforward", null);
        ms.setActionHandler("previoustrack", null);
        ms.setActionHandler("nexttrack", null);
      } catch {
        // ignore
      }
    };
  }, [bookSlug, continueMeta, navigationSuffix, nextStorySlug, prevStorySlug, router, storySlug]);

  // ✅ tracking: carga de audio
  useEffect(() => {
    if (!hasPlayableAudio) return;
    // Skip noisy load tracking on Hobby.
  }, [hasPlayableAudio, storySlug, bookSlug]);

  useEffect(() => {
    if (!hasPlayableAudio) return;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.load();
      setIsPlaying(false);
      setProgress(0);
    }
  }, [hasPlayableAudio, resolvedSrc]);

  useEffect(() => {
    if (!hasPlayableAudio) return;
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress(audio.currentTime);
      const ratio = audio.duration ? audio.currentTime / audio.duration : 0;
      window.dispatchEvent(new CustomEvent("audio-progress", { detail: ratio }));
    };

    const setDur = () => setDuration(audio.duration);

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", setDur);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", setDur);
    };
  }, [hasPlayableAudio]);

  useEffect(() => {
    if (!hasPlayableAudio || !isPlaying || !canTrackContinueListening) return;
    const audio = audioRef.current;
    if (!audio) return;

    const interval = window.setInterval(() => {
      const currentDuration =
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
      if (!shouldPersistProgress(audio.currentTime)) return;
      rememberContinueListening(audio.currentTime);
      void syncContinueListening(storySlug, bookSlug, audio.currentTime, currentDuration);
    }, CONTINUE_SYNC_INTERVAL_MS);

    const persistNow = (transport: "fetch" | "beacon" = "fetch") => {
      const currentProgress = audio.currentTime;
      const currentDuration =
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
      if (!shouldPersistProgress(currentProgress)) return;
      rememberContinueListening(audio.currentTime);
      if (transport === "beacon") {
        syncContinueListeningBeacon(storySlug, bookSlug, currentProgress, currentDuration);
        return;
      }
      void syncContinueListening(storySlug, bookSlug, currentProgress, currentDuration);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      persistNow("beacon");
    };

    const handlePageHide = () => persistNow("beacon");

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    hasPlayableAudio,
    isPlaying,
    duration,
    bookSlug,
    storySlug,
    rememberContinueListening,
    canTrackContinueListening,
    shouldPersistProgress,
  ]);

  useEffect(() => {
    if (!hasPlayableAudio || !canTrackContinueListening) return;
    const audioElement = audioRef.current;
    return () => {
      const currentProgress = audioElement?.currentTime ?? progress;
      const currentDuration =
        audioElement && Number.isFinite(audioElement.duration) && audioElement.duration > 0
          ? audioElement.duration
          : duration;
      if (!shouldPersistProgress(currentProgress)) return;
      rememberContinueListening(currentProgress);
      void syncContinueListening(storySlug, bookSlug, currentProgress, currentDuration);
    };
  }, [
    hasPlayableAudio,
    storySlug,
    bookSlug,
    progress,
    duration,
    rememberContinueListening,
    canTrackContinueListening,
    shouldPersistProgress,
  ]);

  useEffect(() => {
    if (!hasPlayableAudio) return;
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = async () => {
      await trackMetric(storySlug, bookSlug, "audio_complete", duration);
      trackGa4Event("story_completed", { story_slug: storySlug, book_slug: bookSlug ?? "standalone", duration_sec: Math.round(duration) });
      void releaseWakeLock();
      if (nextStorySlug) {
        router.push(`/books/${bookSlug}/${nextStorySlug}${navigationSuffix}`);
      } else {
        setIsPlaying(false);
        setProgress(0);
      }
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [hasPlayableAudio, nextStorySlug, bookSlug, storySlug, duration, navigationSuffix, router]);

    const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (!hasPlayableAudio) return;

    // 🔒 Si no tiene permiso para reproducir, avisamos al gate y salimos.
    if (!canPlay) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("audio-locked-play"));
      }
      return;
    }

    if (isPlaying) {
      a.pause();
      rememberContinueListening(a.currentTime);
      lastPersistedProgressRef.current = Math.max(0, Math.round(a.currentTime));
      await trackMetric(
        storySlug,
        bookSlug,
        "audio_pause",
        a.currentTime,
        buildContinueMetricMetadata(
          a.currentTime,
          Number.isFinite(a.duration) ? a.duration : duration
        )
      );
      void syncContinueListening(
        storySlug,
        bookSlug,
        a.currentTime,
        Number.isFinite(a.duration) ? a.duration : duration
      );
      setIsPlaying(false);
      void releaseWakeLock();
    } else {
      a.play()
        .then(async () => {
          setIsPlaying(true);
          rememberContinueListening(a.currentTime);
          lastPersistedProgressRef.current = Math.max(0, Math.round(a.currentTime));
          void syncContinueListening(
            storySlug,
            bookSlug,
            a.currentTime,
            Number.isFinite(a.duration) ? a.duration : duration
          );
          void requestWakeLock();
          await trackMetric(storySlug, bookSlug, "audio_play");
          trackGa4Event("audio_played", { story_slug: storySlug, book_slug: bookSlug ?? "standalone" });
        })
        .catch((err) => console.error("[audio] play failed", err));
    }
  };

  const skip = (sec: number) => {
    if (!hasPlayableAudio) return;
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(
        0,
        audioRef.current.currentTime + sec
      );
    }
  };

  const changeSpeed = (v: number) => {
    if (!hasPlayableAudio) return;
    if (audioRef.current) {
      audioRef.current.playbackRate = v;
      setSpeed(v);
      setShowSpeedMenu(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasPlayableAudio) return;
    if (audioRef.current) {
      const newTime = Number(e.target.value);
      audioRef.current.currentTime = newTime;
      setProgress(newTime);
    }
  };

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return "0:00";
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  if (!hasPlayableAudio) {
    return null;
  }

  return (
    <div className="relative w-full rounded-t-xl border-t border-[var(--player-border-top)] bg-[var(--bg-player)] px-4 py-3 text-[var(--foreground)] shadow-2xl backdrop-blur md:ml-64 md:w-[calc(100%-16rem)]">
      <audio ref={audioRef} src={resolvedSrc} preload="metadata" />

      {/* waveform de progreso */}
      <div className="flex items-center gap-3 text-sm text-[var(--muted)] mb-2">
        <span className="w-10 text-right tabular-nums">{formatTime(progress)}</span>
        <div className="relative flex-1 h-9 flex items-center">
          <div className="flex items-center justify-between w-full h-full overflow-hidden">
            {WAVEFORM_BARS.map((h, i) => {
              const played =
                duration > 0 && (i + 0.5) / WAVEFORM_BARS.length <= progress / duration;
              return (
                <div
                  key={i}
                  style={{ height: `${Math.round(h * 100)}%` }}
                  className={`w-[3px] shrink-0 rounded-full transition-colors ${
                    played ? "bg-blue-500" : "bg-[var(--muted)] opacity-40"
                  }`}
                />
              );
            })}
          </div>
          {/* transparent range on top: keeps native drag / click / keyboard seek */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={progress}
            onChange={handleSeek}
            aria-label="Seek"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <span className="w-10 tabular-nums">{formatTime(duration)}</span>
      </div>

      {/* controles compactos */}
      <div className="flex justify-center items-center gap-4 relative">
        {prevStorySlug && (
          <Link
            href={`/books/${bookSlug}/${prevStorySlug}${navigationSuffix}`}
            className="p-1.5 rounded hover:bg-[var(--card-bg-hover)]"
          >
            <SkipBack className="w-6 h-6" />
          </Link>
        )}

        <button
          onClick={() => skip(-15)}
          className="relative p-1.5 rounded-full text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
          aria-label="Rewind 15 seconds"
        >
          <RotateCcw className="w-7 h-7" strokeWidth={1.75} />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold mt-[1px]">
            15
          </span>
        </button>

        <button
          onClick={togglePlay}
          className="p-4 rounded-full bg-blue-500 hover:bg-blue-600 text-white mx-2 shadow-[0_0_26px_-2px_rgba(59,130,246,0.65)] transition-all"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" fill="currentColor" strokeWidth={0} />
          ) : (
            <Play className="w-6 h-6 translate-x-[1px]" fill="currentColor" strokeWidth={0} />
          )}
        </button>

        <button
          onClick={() => skip(15)}
          className="relative p-1.5 rounded-full text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
          aria-label="Forward 15 seconds"
        >
          <RotateCw className="w-7 h-7" strokeWidth={1.75} />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold mt-[1px]">
            15
          </span>
        </button>

        {nextStorySlug && (
          <Link
            href={`/books/${bookSlug}/${nextStorySlug}${navigationSuffix}`}
            className="p-1.5 rounded hover:bg-[var(--card-bg-hover)]"
          >
            <SkipForward className="w-6 h-6" />
          </Link>
        )}

        {/* Selector personalizado */}
        <div className="ml-2 relative">
          <button
            onClick={() => setShowSpeedMenu((v) => !v)}
            className="bg-[var(--chip-bg)] border border-[var(--chip-border)] text-[var(--foreground)] text-sm font-semibold rounded-xl px-3.5 py-1.5 flex items-center gap-1.5 hover:bg-[var(--card-bg-hover)] transition-colors"
          >
            {speed.toFixed(2).replace(/\.00$/, "")}x
            <ChevronUp
              className={`w-3.5 h-3.5 transition-transform ${
                showSpeedMenu ? "rotate-180" : ""
              }`}
            />
          </button>

          {showSpeedMenu && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--card-border)] rounded-lg shadow-lg py-1 text-sm z-50">
              {[0.75, 0.85, 1, 1.15, 1.25].map((v) => (
                <button
                  key={v}
                  onClick={() => changeSpeed(v)}
                  className={`block w-full text-left px-4 py-1 hover:bg-[var(--card-bg-hover)] ${
                    v === speed ? "text-[var(--primary)]" : "text-[var(--foreground)]"
                  }`}
                >
                  {v.toFixed(2).replace(/\.00$/, "")}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
