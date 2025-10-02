"use client";

import { createContext, useState, useContext, ReactNode, useEffect } from "react";

interface AudioContextType {
  currentAudio: string | null;
  setCurrentAudio: (audio: string | null) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);

  // 👇 Agrega este useEffect para debug
  useEffect(() => {
    console.log("🎵 currentAudio cambió a:", currentAudio);
  }, [currentAudio]);

  return (
    <AudioContext.Provider value={{ currentAudio, setCurrentAudio }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}
