"use client";

import { useAudio } from "@/context/AudioContext";
import Player from "./Player";
import { usePathname } from "next/navigation";

export default function PlayerWrapper() {
  const { currentAudio } = useAudio();
  const pathname = usePathname();

  // 👇 solo mostrar en páginas de historias
  const isStoryPage =
    pathname.startsWith("/books/") && pathname.includes("/stories");

  if (!isStoryPage || !currentAudio) return null;

  return <Player src={currentAudio} />; // ✅ pasamos el audio dinámico
}
