'use client';

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { setLastSection } from "../lib/navigationMemory";

export default function BackNavigationHandler() {
  const pathname = usePathname();

  useEffect(() => {
    // Detecta secciones principales
    if (pathname === "/") setLastSection("home");
    else if (pathname.startsWith("/my-library")) setLastSection("my-library");
    else if (pathname.startsWith("/favorites")) setLastSection("favorites");
    else if (pathname.startsWith("/explore")) setLastSection("explore");
    else if (pathname.startsWith("/settings")) setLastSection("settings");
  }, [pathname]);

  return null;
}
