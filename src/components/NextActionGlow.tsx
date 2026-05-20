"use client";

import type { ReactNode } from "react";

type NextActionGlowProps = {
  active: boolean;
  borderRadius?: number;
  inset?: number;
  color?: string;
  children: ReactNode;
};

/**
 * Soft pulsing amber ring around any element to flag "this is the next
 * logical action". Mirrors the mobile NextActionGlow (two concentric rings
 * with opposite-phase opacity) using pure CSS.
 */
export function NextActionGlow({
  active,
  borderRadius = 20,
  inset = -4,
  color = "#f8c15c",
  children,
}: NextActionGlowProps) {
  if (!active) {
    return <>{children}</>;
  }
  return (
    <span className="relative inline-block" data-next-action-glow="true">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: inset - 6,
          left: inset - 6,
          right: inset - 6,
          bottom: inset - 6,
          borderRadius: borderRadius + 6,
          border: `2px solid ${color}`,
          animation: "next-action-outer 2200ms ease-in-out infinite",
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: inset,
          left: inset,
          right: inset,
          bottom: inset,
          borderRadius: borderRadius + 2,
          border: `2px solid ${color}`,
          animation: "next-action-inner 2200ms ease-in-out infinite",
        }}
      />
      {children}
      <style jsx>{`
        @keyframes next-action-outer {
          0%, 100% { opacity: 0.08; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.04); }
        }
        @keyframes next-action-inner {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.95; }
        }
      `}</style>
    </span>
  );
}
