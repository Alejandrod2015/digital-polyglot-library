"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LandingPage.module.css";
import beta from "./BetaPhoneDemo.module.css";

const DURATION_SECONDS = 92; // displayed as 1:32

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function BetaPhoneDemo() {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!prefersReducedMotion);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    const tick = (now: number) => {
      if (last.current == null) last.current = now;
      const dt = (now - last.current) / 1000;
      last.current = now;
      // 12x speed so the demo loops in ~7.5s while showing realistic
      // timestamps to the viewer
      setT((p) => {
        const next = p + dt * 12;
        return next > DURATION_SECONDS ? 0 : next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing]);

  const progress = Math.min(1, t / DURATION_SECONDS);

  return (
    <div className={styles.phoneStage} aria-hidden="true">
      <div className={styles.phone}>
        <div className={styles.phoneNotch} />
        <div className={styles.phoneStatus}>
          <span>3:48</span>
          <div className="icons">
            <svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path
                d="M1 4 a8 8 0 0 1 12 0M3 6.5 a5 5 0 0 1 8 0M5 9 a2.5 2.5 0 0 1 4 0"
                strokeLinecap="round"
              />
            </svg>
            <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
              <rect
                x="0.5"
                y="0.5"
                width="18"
                height="10"
                rx="2.5"
                stroke="currentColor"
                opacity="0.5"
              />
              <rect x="2" y="2" width="15" height="7" rx="1.5" fill="#a3e635" />
              <path d="M20 4 v3" stroke="currentColor" opacity="0.5" />
            </svg>
          </div>
        </div>

        <div className={beta.screen}>
          <div className={beta.headerRow}>
            <button className={beta.iconBtn} type="button" aria-label="Back">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className={beta.headerActions}>
              <button className={beta.iconBtn} type="button" aria-label="Save">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h12v18l-6-4-6 4V3z" />
                </svg>
              </button>
              <button className={beta.iconBtn} type="button" aria-label="Download">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
            </div>
          </div>

          <h3 className={beta.title}>Tinto en La Candelaria</h3>

          <div className={beta.cover} aria-hidden="true">
            <div className={beta.coverScene}>
              <span className={beta.coverEmoji}>☕</span>
            </div>
          </div>

          <div className={beta.body}>
            Es martes por la{" "}
            <span className={`${beta.vocab} ${beta.vocabSky}`}>mañana</span>{" "}
            en La Candelaria. Marta{" "}
            <span className={`${beta.vocab} ${beta.vocabMaroon}`}>camina</span>{" "}
            hacia un café pequeño en la esquina. Dentro hay un{" "}
            <span className={`${beta.vocab} ${beta.vocabSky}`}>olor</span>{" "}
            fuerte a café molido.
          </div>

          <div className={beta.player}>
            <div className={beta.playerScrub}>
              <span className={beta.ts}>{fmt(t)}</span>
              <div className={beta.scrubTrack}>
                <div className={beta.scrubFill} style={{ width: `${progress * 100}%` }} />
                <div className={beta.scrubHandle} style={{ left: `${progress * 100}%` }} />
              </div>
              <span className={beta.ts}>1:32</span>
            </div>
            <div className={beta.playerControls}>
              <button className={beta.controlSmall} type="button" aria-label="Back 10 seconds">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span className={beta.skipLabel}>10</span>
              </button>
              <button
                className={beta.controlPlay}
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button className={beta.controlSmall} type="button" aria-label="Forward 10 seconds">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                <span className={beta.skipLabel}>10</span>
              </button>
              <button className={beta.controlSpeed} type="button">
                1x
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
