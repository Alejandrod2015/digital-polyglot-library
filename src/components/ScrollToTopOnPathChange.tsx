"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ScrollToTopOnPathChange() {
  const pathname = usePathname();

  useEffect(() => {
    // The app uses a persistent <main> with overflow scroll.
    // Reset both the container and window to ensure story pages open at top.
    const main = document.querySelector("main");
    if (main instanceof HTMLElement) {
      main.scrollTo({ top: 0, behavior: "auto" });
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

