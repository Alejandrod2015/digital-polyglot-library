"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const TRIGGER_PX = 70;
const MAX_PULL_PX = 110;

/**
 * Touch-based pull-to-refresh. Wrap any page section. Only fires when the
 * scroll container is at the top, so it doesn't conflict with regular
 * vertical scrolling. Pointer/mouse drags are ignored to keep desktop
 * behaviour intact.
 */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);

  useEffect(() => {
    const handleStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      if (refreshing) return;
      const touch = e.touches[0];
      if (!touch) return;
      startY.current = touch.clientY;
      tracking.current = true;
    };
    const handleMove = (e: TouchEvent) => {
      if (!tracking.current || startY.current === null) return;
      const touch = e.touches[0];
      if (!touch) return;
      const delta = touch.clientY - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      // Translate the linear delta into a slightly dampened pull so the
      // gesture feels rubber-banded rather than 1:1.
      const damped = Math.min(MAX_PULL_PX, delta * 0.55);
      setPull(damped);
    };
    const handleEnd = async () => {
      if (!tracking.current) return;
      tracking.current = false;
      startY.current = null;
      if (pull >= TRIGGER_PX) {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };
    window.addEventListener("touchstart", handleStart, { passive: true });
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("touchcancel", handleEnd);
    return () => {
      window.removeEventListener("touchstart", handleStart);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, [onRefresh, pull, refreshing]);

  const progress = Math.min(1, pull / TRIGGER_PX);

  return (
    <div className="relative">
      {(pull > 0 || refreshing) ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
          style={{
            transform: `translateY(${Math.max(0, pull - 40)}px)`,
            transition: refreshing ? "transform 200ms ease-out" : "none",
          }}
        >
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[rgba(7,15,30,0.92)] text-white/85 shadow-lg backdrop-blur"
            style={{
              transform: `rotate(${progress * 220}deg)`,
              transition: refreshing ? "transform 600ms linear infinite" : "none",
              animation: refreshing ? "ptr-spin 0.9s linear infinite" : undefined,
            }}
          >
            <RefreshCw size={16} />
          </span>
        </div>
      ) : null}
      <div
        style={{
          transform: pull > 0 || refreshing ? `translateY(${pull * 0.5}px)` : "none",
          transition: refreshing ? "transform 200ms ease-out" : "none",
        }}
      >
        {children}
      </div>
      <style jsx>{`
        @keyframes ptr-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
