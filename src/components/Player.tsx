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

// ✅ nuevo helper para tracking
async function trackMetric(
  storySlug: string,
  bookSlug: string,
  eventType: string,
  value?: number
) {
  try {
    await fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storySlug, bookSlug, eventType, value }),
    });
  } catch {
    // silencioso
  }
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

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
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
    if (normalized.startsWith("http")) return normalized;
    const sanitized = normalized.replace(/^\/+/, "");
    if (!sanitized) return "";
    return `https://cdn.sanity.io/files/9u7ilulp/production/${sanitized}.mp3`;
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
          },
        })
      );
    } catch {
      // silencioso
    }
  }, [bookSlug, continueMeta, duration, hasPlayableAudio, storySlug]);

  // ✅ tracking: carga de audio
  useEffect(() => {
    if (!hasPlayableAudio) return;
    void trackMetric(storySlug, bookSlug, "audio_load");
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
      rememberContinueListening(audio.currentTime);
      void syncContinueListening(
        storySlug,
        bookSlug,
        audio.currentTime,
        Number.isFinite(audio.duration) ? audio.duration : duration
      );
    }, 5000);

    const persistNow = () => {
      const currentProgress = audio.currentTime;
      const currentDuration =
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
      rememberContinueListening(audio.currentTime);
      syncContinueListeningBeacon(storySlug, bookSlug, currentProgress, currentDuration);
      void syncContinueListening(storySlug, bookSlug, currentProgress, currentDuration);
    };

    window.addEventListener("pagehide", persistNow);
    document.addEventListener("visibilitychange", persistNow);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pagehide", persistNow);
      document.removeEventListener("visibilitychange", persistNow);
    };
  }, [
    hasPlayableAudio,
    isPlaying,
    duration,
    bookSlug,
    storySlug,
    rememberContinueListening,
    canTrackContinueListening,
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
      rememberContinueListening(currentProgress);
      syncContinueListeningBeacon(storySlug, bookSlug, currentProgress, currentDuration);
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
  ]);

  useEffect(() => {
    if (!hasPlayableAudio) return;
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = async () => {
      await trackMetric(storySlug, bookSlug, "audio_complete", duration);
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
      void syncContinueListening(
        storySlug,
        bookSlug,
        a.currentTime,
        Number.isFinite(a.duration) ? a.duration : duration
      );
      setIsPlaying(false);
      void releaseWakeLock();
      await trackMetric(storySlug, bookSlug, "audio_pause", progress);
    } else {
      a.play()
        .then(async () => {
          setIsPlaying(true);
          rememberContinueListening(a.currentTime);
          void syncContinueListening(
            storySlug,
            bookSlug,
            a.currentTime,
            Number.isFinite(a.duration) ? a.duration : duration
          );
          void requestWakeLock();
          await trackMetric(storySlug, bookSlug, "audio_play");
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
      void trackMetric(storySlug, bookSlug, "speed_change", v);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasPlayableAudio) return;
    if (audioRef.current) {
      const newTime = Number(e.target.value);
      audioRef.current.currentTime = newTime;
      setProgress(newTime);
      void trackMetric(storySlug, bookSlug, "seek", newTime);
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
    <div className="bg-[var(--bg-player)] border-t border-[var(--player-border-top)] px-4 py-3 rounded-t-xl shadow-2xl backdrop-blur w-full relative text-[var(--foreground)]">
      <audio ref={audioRef} src={resolvedSrc} preload="metadata" />

      {/* barra de progreso */}
      <div className="flex items-center gap-2 text-sm text-[var(--muted)] mb-2">
        <span className="w-10 text-right">{formatTime(progress)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={progress}
          onChange={handleSeek}
          className="w-full accent-blue-500 h-1.5"
        />
        <span className="w-10">{formatTime(duration)}</span>
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
          className="relative p-1.5 rounded hover:bg-[var(--card-bg-hover)]"
        >
          <RotateCcw className="w-6 h-6" />
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">
            15
          </span>
        </button>

        <button
          onClick={togglePlay}
          className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white mx-2"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={() => skip(15)}
          className="relative p-1.5 rounded hover:bg-[var(--card-bg-hover)]"
        >
          <RotateCw className="w-6 h-6" />
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">
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
            className="bg-[var(--chip-bg)] border border-[var(--chip-border)] text-[var(--foreground)] text-sm rounded px-2 py-1 flex items-center gap-1 hover:bg-[var(--card-bg-hover)]"
          >
            {speed.toFixed(2).replace(/\.00$/, "")}x
            <ChevronUp
              className={`w-3 h-3 transition-transform ${
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
