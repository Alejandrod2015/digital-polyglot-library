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
} from "lucide-react";
import { books } from "@/data/books";

// --- Wake Lock setup (mantener pantalla encendida) ---
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
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Wake Lock
const wakeLockRef = useRef<WakeLockSentinel | null>(null);
const navWL = getWakeLockNavigator();

const requestWakeLock = async () => {
  try {
    if (!navWL) return;
    if (wakeLockRef.current) return;
    wakeLockRef.current = await navWL.wakeLock.request("screen");
    const onRelease = () => {
      wakeLockRef.current = null;
    };
    wakeLockRef.current.addEventListener("release", onRelease);
  } catch {
    // navegador no soporta o permisos denegados
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

  // convertir assetId en URL reproducible si es necesario
  const resolvedSrc = useMemo(() => {
    if (!src) return "";
    if (src.startsWith("http")) return src; // ya es URL
    // Sanity asset ID → URL pública
    return `https://cdn.sanity.io/files/9u7ilulp/production/${src}.mp3`;
  }, [src]);

  // localizar libro e historias
  const book = Object.values(books).find((b) => b.slug === bookSlug);
  const stories = book?.stories || [];

  // encontrar historia actual
  const currentIndex = stories.findIndex(
    (s) => s.slug === storySlug || s.id === storySlug
  );
  const prevStory = currentIndex > 0 ? stories[currentIndex - 1] : null;
  const nextStory =
    currentIndex >= 0 && currentIndex < stories.length - 1
      ? stories[currentIndex + 1]
      : null;

  // reiniciar audio cuando cambia el src
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.load();
      setIsPlaying(false);
      setProgress(0);
    }
  }, [resolvedSrc]);

  // sincronizar progreso
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => setProgress(audio.currentTime);
    const setDur = () => setDuration(audio.duration);

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", setDur);

    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("loadedmetadata", setDur);
    };
  }, []);

  // reproducir automáticamente la siguiente historia cuando termina el audio
useEffect(() => {
  const audio = audioRef.current;
  if (!audio) return;

  const handleEnded = () => {
    void releaseWakeLock(); // 🔹 liberar wake lock al terminar
    if (nextStory) {
      window.location.href = `/books/${bookSlug}/${nextStory.slug}`;
    } else {
      setIsPlaying(false);
      setProgress(0);
    }
  };

  audio.addEventListener("ended", handleEnded);
  return () => audio.removeEventListener("ended", handleEnded);
}, [nextStory, bookSlug]);

    const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
      void releaseWakeLock(); // 🔹 liberar
    } else {
      a.play()
        .then(() => {
          setIsPlaying(true);
          void requestWakeLock(); // 🔹 activar
        })
        .catch((err) => console.error("[audio] play failed", err));
    }
  };

  const changeSpeed = (v: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = v;
      setSpeed(v);
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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Number(e.target.value);
      setProgress(Number(e.target.value));
    }
  };

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return "0:00";
    const minutes = Math.floor(sec / 60);
    const seconds = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  // Liberar Wake Lock al desmontar
  useEffect(() => {
    return () => {
      void releaseWakeLock();
    };
  }, []);

  return (
    <div className="bg-black/80 p-4 rounded-t-xl shadow-2xl backdrop-blur w-full">
      {/* audio */}
      <audio ref={audioRef} src={resolvedSrc} preload="metadata" />

      {/* barra de progreso */}
      <div className="flex items-center gap-2 text-sm text-gray-300">
        <span>{formatTime(progress)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={progress}
          onChange={handleSeek}
          className="w-full accent-blue-500"
        />
        <span>{formatTime(duration)}</span>
      </div>

      {/* controles + navegación */}
      <div className="flex justify-center items-center gap-6 mt-4">
        {prevStory ? (
          <Link
            href={`/books/${bookSlug}/${prevStory.slug}`}
            className="p-2 rounded hover:bg-gray-800"
          >
            <SkipBack className="w-8 h-8" />
          </Link>
        ) : (
          <div className="w-8 h-8" />
        )}

        <button
          onClick={() => skip(-15)}
          className="relative p-2 rounded hover:bg-gray-800"
        >
          <RotateCcw className="w-8 h-8" />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
            15
          </span>
        </button>

        <button
          onClick={togglePlay}
          className="p-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </button>

        <button
          onClick={() => skip(15)}
          className="relative p-2 rounded hover:bg-gray-800"
        >
          <RotateCw className="w-8 h-8" />
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
            15
          </span>
        </button>

        {nextStory ? (
          <Link
            href={`/books/${bookSlug}/${nextStory.slug}`}
            className="p-2 rounded hover:bg-gray-800"
          >
            <SkipForward className="w-8 h-8" />
          </Link>
        ) : (
          <div className="w-8 h-8" />
        )}
      </div>

      <div className="flex justify-center mt-3">
        <select
          value={speed}
          onChange={(e) => changeSpeed(Number(e.target.value))}
          className="bg-gray-800 px-2 py-1 rounded text-sm"
        >
          <option value={0.75}>0.75x</option>
          <option value={0.85}>0.85x</option>
          <option value={1}>1x</option>
          <option value={1.15}>1.15x</option>
          <option value={1.25}>1.25x</option>
        </select>
      </div>
    </div>
  );
}
