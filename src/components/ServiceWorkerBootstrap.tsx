"use client";

import { useEffect } from "react";

export default function ServiceWorkerBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[sw] registration failed", error);
        }
      }
    };

    void register();
  }, []);

  return null;
}
