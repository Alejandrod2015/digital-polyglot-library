"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  ChevronUp,
} from "lucide-react";
import { books } from "@/data/books";

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
}

export default function Player({ src, bookSlug, storySlug }: PlayerProps) {
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
    if (!src) return "";
    if (src.startsWith("http")) return src;
    return `https://cdn.sanity.io/files/9u7ilulp/production/${src}.mp3`;
  }, [src]);

  const book = Object.values(books).find((b) => b.slug === bookSlug);
  const stories = book?.stories || [];
  const currentIndex = stories.findIndex(
    (s) => s.slug === storySlug || s.id === storySlug
  );
  const prevStory = currentIndex > 0 ? stories[currentIndex - 1] : null;
  const nextStory =
    currentIndex >= 0 && currentIndex < stories.length - 1
      ? stories[currentIndex + 1]
      : null;

  // ✅ tracking: carga de audio
  useEffect(() => {
    void trackMetric(storySlug, bookSlug, "audio_load");
  }, [storySlug, bookSlug]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.load();
      setIsPlaying(false);
      setProgress(0);
    }
  }, [resolvedSrc]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = async () => {
      await trackMetric(storySlug, bookSlug, "audio_complete", duration);
      void releaseWakeLock();
      if (nextStory) {
        window.location.href = `/books/${bookSlug}/${nextStory.slug}`;
      } else {
        setIsPlaying(false);
        setProgress(0);
      }
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [nextStory, bookSlug, storySlug, duration]);

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
      void releaseWakeLock();
      await trackMetric(storySlug, bookSlug, "audio_pause", progress);
    } else {
      a.play()
        .then(async () => {
          setIsPlaying(true);
          void requestWakeLock();
          await trackMetric(storySlug, bookSlug, "audio_play");
        })
        .catch((err) => console.error("[audio] play failed", err));
    }
  };

  const skip = (sec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(
        0,
        audioRef.current.currentTime + sec
      );
    }
  };

  const changeSpeed = (v: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = v;
      setSpeed(v);
      setShowSpeedMenu(false);
      void trackMetric(storySlug, bookSlug, "speed_change", v);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <div className="bg-black/80 px-4 py-3 rounded-t-xl shadow-2xl backdrop-blur w-full relative">
      <audio ref={audioRef} src={resolvedSrc} preload="metadata" />

      {/* barra de progreso */}
      <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
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
        {prevStory && (
          <Link
            href={`/books/${bookSlug}/${prevStory.slug}`}
            className="p-1.5 rounded hover:bg-gray-800"
          >
            <SkipBack className="w-6 h-6" />
          </Link>
        )}

        <button
          onClick={() => skip(-15)}
          className="relative p-1.5 rounded hover:bg-gray-800"
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
          className="relative p-1.5 rounded hover:bg-gray-800"
        >
          <RotateCw className="w-6 h-6" />
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">
            15
          </span>
        </button>

        {nextStory && (
          <Link
            href={`/books/${bookSlug}/${nextStory.slug}`}
            className="p-1.5 rounded hover:bg-gray-800"
          >
            <SkipForward className="w-6 h-6" />
          </Link>
        )}

        {/* Selector personalizado */}
        <div className="ml-2 relative">
          <button
            onClick={() => setShowSpeedMenu((v) => !v)}
            className="bg-gray-800 text-sm rounded px-2 py-1 flex items-center gap-1 hover:bg-gray-700"
          >
            {speed.toFixed(2).replace(/\.00$/, "")}x
            <ChevronUp
              className={`w-3 h-3 transition-transform ${
                showSpeedMenu ? "rotate-180" : ""
              }`}
            />
          </button>

          {showSpeedMenu && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg py-1 text-sm z-50">
              {[0.75, 0.85, 1, 1.15, 1.25].map((v) => (
                <button
                  key={v}
                  onClick={() => changeSpeed(v)}
                  className={`block w-full text-left px-4 py-1 hover:bg-gray-700 ${
                    v === speed ? "text-blue-400" : "text-white"
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
