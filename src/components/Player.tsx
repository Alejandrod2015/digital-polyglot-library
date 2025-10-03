"use client";

import { useRef, useState, useEffect } from "react";
import { Play, Pause, RotateCcw, RotateCw } from "lucide-react";

interface PlayerProps {
  src: string; // 👈 recibimos el audio dinámico
}

export default function Player({ src }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // 🔄 cada vez que cambia el src, reiniciamos el player
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.load();
      setIsPlaying(false);
      setProgress(0);
    }
  }, [src]);

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

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
    } else {
      a.play();
      setIsPlaying(true);
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

  return (
    <div className="bg-black/80 p-4 rounded-t-xl shadow-2xl backdrop-blur w-full">
      {/* 👇 ahora el src es dinámico */}
      <audio ref={audioRef} src={src} />

      {/* Barra de progreso */}
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

      {/* Botones + selector de velocidad */}
      <div className="flex justify-center items-center gap-6 mt-4">
        <button
          onClick={() => skip(-15)}
          className="relative p-2 rounded hover:bg-gray-800"
        >
          <RotateCcw className="w-10 h-10" />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
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
          <RotateCw className="w-10 h-10" />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
            15
          </span>
        </button>

        {/* Selector de velocidad */}
        <select
          value={speed}
          onChange={(e) => changeSpeed(Number(e.target.value))}
          className="bg-gray-800 px-2 py-1 rounded text-sm"
        >
          <option value={0.75}>0.5x</option>
          <option value={0.9}>0.75x</option>
          <option value={1}>1x</option>
          <option value={1.1}>1.25x</option>
          <option value={1.25}>1.5x</option>
        </select>
      </div>
    </div>
  );
}
