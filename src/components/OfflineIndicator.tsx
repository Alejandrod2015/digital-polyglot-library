"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Discreet banner shown when the browser reports navigator.onLine = false.
 * Sits above the header in the fixed top corner so it's always visible.
 */
export function OfflineIndicator() {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 top-2 z-[70] -translate-x-1/2 rounded-full border border-amber-300/30 bg-amber-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100 backdrop-blur"
    >
      <span className="inline-flex items-center gap-1.5">
        <WifiOff size={12} />
        Offline
      </span>
    </div>
  );
}
