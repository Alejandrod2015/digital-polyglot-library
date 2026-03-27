"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

let toastId = 0;
const listeners = new Set<(t: ToastItem) => void>();

/** Fire a toast from anywhere. */
export function showToast(message: string, type: ToastType = "success") {
  const item: ToastItem = { id: ++toastId, message, type };
  listeners.forEach((fn) => fn(item));
}

const COLORS: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: "#10b981", icon: "\u2713" },
  error: { bg: "#ef4444", icon: "!" },
};

/**
 * Render this once (e.g. at the bottom of each editor).
 * It auto-stacks and auto-dismisses toasts.
 */
export default function StudioToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const add = (t: ToastItem) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 3500);
    };
    listeners.add(add);
    return () => { listeners.delete(add); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none" }}>
      {toasts.map((t) => {
        const c = COLORS[t.type];
        return (
          <div
            key={t.id}
            className="studio-toast"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 20px",
              borderRadius: 10,
              backgroundColor: c.bg,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
              pointerEvents: "auto",
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>
              {c.icon}
            </span>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
