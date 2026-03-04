"use client";

import { useEffect } from "react";

type ThemePref = "system" | "dark" | "light";

const STORAGE_KEY = "dp_theme_pref";

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  if (pref === "system") {
    root.removeAttribute("data-theme");
    const system = getSystemTheme();
    if (metaTheme) metaTheme.setAttribute("content", system === "dark" ? "#0b1e36" : "#eef3fb");
    return;
  }

  root.setAttribute("data-theme", pref);
  if (metaTheme) metaTheme.setAttribute("content", pref === "dark" ? "#0b1e36" : "#eef3fb");
}

export default function ThemeController() {
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemePref | null) ?? "system";
    const pref: ThemePref =
      stored === "dark" || stored === "light" || stored === "system" ? stored : "system";
    applyTheme(pref);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = () => {
      const current = (localStorage.getItem(STORAGE_KEY) as ThemePref | null) ?? "system";
      if (current === "system") applyTheme("system");
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = (event.newValue as ThemePref | null) ?? "system";
      if (next === "dark" || next === "light" || next === "system") {
        applyTheme(next);
      }
    };

    media.addEventListener("change", onSystemThemeChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("dp-theme-change", onSystemThemeChange as EventListener);

    return () => {
      media.removeEventListener("change", onSystemThemeChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("dp-theme-change", onSystemThemeChange as EventListener);
    };
  }, []);

  return null;
}
