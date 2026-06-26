"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  width?: number | string;
};

// Compact audio player styled with .jm-mini tokens. Replaces the native
// <audio controls> chrome inside Studio surfaces so playback widgets stay
// on-brand (teal accent, navy bg, JetBrains Mono time).
export default function MiniPlayer({ src, width }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      setCurrentTime(el.currentTime);
      setProgress(el.duration ? (el.currentTime / el.duration) * 100 : 0);
    };
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
    };
  }, []);

  // Reset state if the source URL changes (regenerated audio, swapped ex).
  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else void el.play();
    setPlaying(!playing);
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration;
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  return (
    <div className="jm-mini" style={width ? { width } : undefined}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={togglePlay}
        className="jm-mini__play"
        aria-label={playing ? "Pause" : "Play"}
        type="button"
      >
        {playing ? (
          <svg width={14} height={14} viewBox="0 0 16 16" fill="currentColor">
            <rect x="4" y="3" width="3" height="10" />
            <rect x="9" y="3" width="3" height="10" />
          </svg>
        ) : (
          <svg width={14} height={14} viewBox="0 0 16 16" fill="currentColor">
            <polygon points="4 3 13 8 4 13" />
          </svg>
        )}
      </button>
      <div onClick={seek} className="jm-mini__track">
        <div className="jm-mini__fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="jm-mini__time">{duration > 0 ? fmt(currentTime) : "-"}</span>
    </div>
  );
}
