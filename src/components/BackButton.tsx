'use client';

import { useRouter } from "next/navigation";
import { getLastSection } from "@/lib/navigationMemory";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  const last = getLastSection();

  // Definimos destinos lógicos según la jerarquía
  const destinations: Record<string, string> = {
    home: "/",
    "my-library": "/my-library",
    favorites: "/favorites",
    explore: "/explore",
    settings: "/settings",
  };

  // Si no hay registro previo, mandamos al home
  const target = destinations[last || "home"];

  return (
    <button
      onClick={() => router.push(target)}
      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-gray-700 transition-colors"
    >
      <ArrowLeft className="h-5 w-5" />
      <span>Back</span>
    </button>
  );
}
