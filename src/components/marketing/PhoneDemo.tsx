"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LandingPage.module.css";

type Word = {
  t: string;
  s: number;
  e: number;
  vocab?: boolean;
};

const WORDS: Word[] = [
  { t: "Era", s: 0.0, e: 0.55 },
  { t: "julio", s: 0.55, e: 1.25 },
  { t: "cuando", s: 1.25, e: 1.85 },
  { t: "el", s: 1.85, e: 2.05 },
  { t: "abuelo", s: 2.05, e: 2.85, vocab: true },
  { t: "me", s: 2.85, e: 3.15 },
  { t: "mandó", s: 3.15, e: 3.95 },
  { t: "aquella", s: 3.95, e: 4.55 },
  { t: "carta", s: 4.55, e: 5.25, vocab: true },
  { t: "amarillenta", s: 5.25, e: 6.45, vocab: true },
  { t: "desde", s: 6.45, e: 6.95 },
  { t: "Oaxaca.", s: 6.95, e: 8.05 },
];
const DURATION = 8.5;

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PhoneDemo() {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!prefersReducedMotion);
  const [showTip, setShowTip] = useState(false);
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
      setT((p) => {
        const next = p + dt;
        return next > DURATION ? 0 : next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const id = setInterval(() => setShowTip((s) => !s), 5200);
    return () => clearInterval(id);
  }, [prefersReducedMotion]);

  const activeIdx = WORDS.findIndex((w) => t >= w.s && t < w.e);
  const progress = Math.min(1, t / DURATION);

  return (
    <div className={styles.phoneStage} aria-hidden="true">
      <div className={styles.phone}>
        <div className={styles.phoneNotch} />
        <div className={styles.phoneStatus}>
          <span>9:41</span>
          <div className="icons">
            <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor">
              <rect x="0" y="6" width="3" height="5" rx="0.5" />
              <rect x="4" y="4" width="3" height="7" rx="0.5" />
              <rect x="8" y="2" width="3" height="9" rx="0.5" />
              <rect x="12" y="0" width="3" height="11" rx="0.5" />
            </svg>
            <svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path
                d="M1 4 a8 8 0 0 1 12 0M3 6.5 a5 5 0 0 1 8 0M5 9 a2.5 2.5 0 0 1 4 0"
                strokeLinecap="round"
              />
            </svg>
            <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
              <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" opacity="0.5" />
              <rect x="2" y="2" width="15" height="7" rx="1.5" fill="currentColor" />
              <path d="M20 4 v3" stroke="currentColor" opacity="0.5" />
            </svg>
          </div>
        </div>

        <div className={styles.phoneScreen}>
          <div className={styles.readerTop}>
            <button className={styles.iconBtn} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className={styles.langPill}>
              <span className={styles.langPillFlag}>🇲🇽</span>
              Español
              <span className={styles.langPillLvl}>B1</span>
            </div>
            <button className={styles.iconBtn} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M6 3h12v18l-6-4-6 4V3z" />
              </svg>
            </button>
          </div>

          <div className={styles.readerMeta}>
            <div className={styles.readerMetaSmall}>Short fiction</div>
            <h3>La carta del abuelo</h3>
          </div>

          <div className={styles.readerText}>
            {WORDS.map((w, i) => {
              const cls = [
                styles.w,
                i === activeIdx ? styles.wActive : "",
                i < activeIdx ? styles.wRead : "",
                w.vocab ? styles.wVocab : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <span key={i}>
                  <span
                    className={cls}
                    onClick={() => {
                      setT(w.s);
                      if (w.vocab) setShowTip(true);
                    }}
                  >
                    {w.t}
                  </span>{" "}
                </span>
              );
            })}
          </div>

          {showTip && (
            <div className={styles.wordTip} onClick={() => setShowTip(false)}>
              <div className={styles.wordTipRow1}>
                <div className={styles.wordTipWord}>amarillenta</div>
                <div className={styles.wordTipPos}>adj.</div>
              </div>
              <div className={styles.wordTipDef}>
                yellowed; faded with age, as old paper.
              </div>
              <div className={styles.wordTipActs}>
                <button type="button">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M11 5L6 9H2v6h4l5 4V5zM19 9c1.5 1 1.5 5 0 6" />
                  </svg>
                  Listen
                </button>
                <button type="button" className={styles.wordTipActsPrimary}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Save
                </button>
              </div>
            </div>
          )}

          <div className={styles.readerPlayer}>
            <button
              className={styles.playBtn}
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 4l13 8-13 8V4z" />
                </svg>
              )}
            </button>
            <div className={styles.playerInfo}>
              <div className={styles.playerInfoRow}>
                <span className={styles.playerInfoNow}>Native narration</span>
                <span className={styles.playerInfoTs}>
                  {fmt(t)} / {fmt(DURATION)}
                </span>
              </div>
              <div
                className={styles.playerProgress}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const ratio = Math.max(
                    0,
                    Math.min(1, (e.clientX - r.left) / r.width),
                  );
                  setT(ratio * DURATION);
                }}
              >
                <div
                  className={styles.playerProgressFill}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
            <button className={styles.speedTag} type="button">
              1.0×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
