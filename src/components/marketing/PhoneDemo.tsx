"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./LandingPage.module.css";

const COVER_URL =
  "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/covers/journey-stories/mole-en-san-angel-1778228912112.png";

type VocabKind = "sky" | "green";

type Word = {
  t: string;
  s: number;
  e: number;
  vocab?: VocabKind;
  breakBefore?: boolean;
};

const WORDS: Word[] = [
  { t: "Es", s: 0.0, e: 0.35 },
  { t: "jueves", s: 0.35, e: 0.9 },
  { t: "al", s: 0.9, e: 1.05 },
  { t: "mediodía.", s: 1.05, e: 1.85 },
  { t: "La", s: 1.85, e: 2.05 },
  { t: "fonda", s: 2.05, e: 2.6, vocab: "sky" },
  { t: "de", s: 2.6, e: 2.75 },
  { t: "San", s: 2.75, e: 3.0 },
  { t: "Ángel", s: 3.0, e: 3.55 },
  { t: "está", s: 3.55, e: 4.0 },
  { t: "abierta", s: 4.0, e: 4.6 },
  { t: "y", s: 4.6, e: 4.75 },
  { t: "huele", s: 4.75, e: 5.25 },
  { t: "a", s: 5.25, e: 5.4 },
  { t: "mole.", s: 5.4, e: 6.0, vocab: "sky" },
  { t: "En", s: 6.0, e: 6.2 },
  { t: "la", s: 6.2, e: 6.3 },
  { t: "cocina,", s: 6.3, e: 6.85 },
  { t: "doña", s: 6.85, e: 7.15 },
  { t: "Luz", s: 7.15, e: 7.5 },
  { t: "mueve", s: 7.5, e: 7.95 },
  { t: "una", s: 7.95, e: 8.15 },
  { t: "olla", s: 8.15, e: 8.55, vocab: "sky" },
  { t: "grande.", s: 8.55, e: 9.15 },
  { t: "Hoy", s: 9.15, e: 9.4, breakBefore: true },
  { t: "está", s: 9.4, e: 9.75 },
  { t: "cansada.", s: 9.75, e: 10.6, vocab: "green" },
  { t: "Pero", s: 10.7, e: 10.95 },
  { t: "ella", s: 10.95, e: 11.2 },
  { t: "sonríe.", s: 11.2, e: 11.85 },
  { t: "Don", s: 11.95, e: 12.2 },
  { t: "Pedro", s: 12.2, e: 12.75 },
  { t: "pide", s: 12.75, e: 13.15 },
  { t: "su", s: 13.15, e: 13.3 },
  { t: "mole", s: 13.3, e: 13.7, vocab: "sky" },
  { t: "también.", s: 13.7, e: 14.4 },
  { t: "Comen", s: 14.5, e: 14.85 },
  { t: "juntos", s: 14.85, e: 15.25 },
  { t: "en", s: 15.25, e: 15.4 },
  { t: "silencio.", s: 15.4, e: 16.1 },
];
const DURATION = 16.5;

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const TIP_TRIGGER_WORD = "fonda";
const TOTAL_SECONDS = 70; // displayed timestamp ceiling (1:10)

export default function PhoneDemo() {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!prefersReducedMotion);
  const [showTip, setShowTip] = useState(false);
  const [manuallyClosed, setManuallyClosed] = useState(false);
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
        if (next > DURATION) {
          setManuallyClosed(false);
          return 0;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setShowTip(!manuallyClosed);
      return;
    }
    if (manuallyClosed) {
      setShowTip(false);
      return;
    }
    const trigger = WORDS.find((w) => w.t === TIP_TRIGGER_WORD);
    if (!trigger) return;
    setShowTip(t >= trigger.s && t < DURATION - 0.5);
  }, [t, prefersReducedMotion, manuallyClosed]);

  const activeIdx = WORDS.findIndex((w) => t >= w.s && t < w.e);
  const progress = Math.min(1, t / DURATION);
  const displayTimestamp = fmt(progress * TOTAL_SECONDS);

  return (
    <div className={styles.phoneStage} aria-hidden="true">
      <div className={styles.phone}>
        <div className={styles.phoneNotch} />
        <div className={styles.phoneStatus}>
          <span>9:41</span>
          <div className="icons">
            <svg width="13" height="10" viewBox="0 0 13 10" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path
                d="M1 3.5 a7 7 0 0 1 11 0M2.6 5.6 a4.5 4.5 0 0 1 7.8 0M4.4 7.7 a2.2 2.2 0 0 1 4.2 0"
                strokeLinecap="round"
              />
            </svg>
            <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
              <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" opacity="0.45" />
              <rect x="2" y="2" width="15" height="7" rx="1.5" fill="currentColor" />
              <path d="M20 4 v3" stroke="currentColor" opacity="0.45" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <div className={styles.phoneScreen}>
          <div className={styles.readerHeaderRow}>
            <button className={styles.iconBtnRound} type="button" aria-label="Back">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className={styles.readerHeaderActions}>
              <button className={styles.iconBtnRound} type="button" aria-label="Save">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 3h12v18l-6-4-6 4V3z" />
                </svg>
              </button>
              <button className={styles.iconBtnRound} type="button" aria-label="Download">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
            </div>
          </div>

          <h3 className={styles.readerTitleCentered}>Mole en San Ángel</h3>

          <div className={styles.coverWarm} aria-hidden="true">
            <Image
              src={COVER_URL}
              alt=""
              fill
              sizes="280px"
              className={styles.coverImage}
              priority
            />
          </div>

          <div className={styles.readerBody}>
            {WORDS.map((w, i) => {
              const isActive = i === activeIdx;
              const tokenClasses = [
                styles.w,
                isActive ? styles.wActiveGold : "",
                !isActive && w.vocab === "sky" ? styles.vocabSky : "",
                !isActive && w.vocab === "green" ? styles.vocabGreen : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <span key={i}>
                  {w.breakBefore && <span className={styles.paraBreak} aria-hidden="true" />}
                  <span
                    className={tokenClasses}
                    onClick={() => {
                      setT(w.s);
                      if (w.t === TIP_TRIGGER_WORD) {
                        setManuallyClosed(false);
                        setShowTip(true);
                      }
                    }}
                  >
                    {w.t}
                  </span>
                  {" "}
                </span>
              );
            })}
          </div>

          {showTip && (
            <div className={styles.vocabPanel}>
              <button
                className={styles.vocabPanelClose}
                type="button"
                onClick={() => {
                  setShowTip(false);
                  setManuallyClosed(true);
                }}
                aria-label="Close"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className={styles.vocabPanelWord}>fonda</div>
              <span className={styles.vocabPosSky}>NOUN</span>
              <p className={styles.vocabPanelDef}>Small home-style Mexican eatery</p>
              <button className={styles.vocabSaveBtn} type="button">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  <line x1="17" y1="9" x2="17" y2="13" />
                  <line x1="15" y1="11" x2="19" y2="11" />
                </svg>
                Save word
              </button>
            </div>
          )}

          <div className={styles.audioBar}>
            <div className={styles.audioScrub}>
              <span className={styles.audioTs}>{displayTimestamp}</span>
              <div
                className={styles.audioTrack}
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
                  className={styles.audioFill}
                  style={{ width: `${progress * 100}%` }}
                />
                <div
                  className={styles.audioHandle}
                  style={{ left: `${progress * 100}%` }}
                />
              </div>
              <span className={styles.audioTs}>1:10</span>
            </div>
            <div className={styles.audioControls}>
              <button className={styles.audioSkip} type="button" aria-label="Back 10s">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                <span className={styles.audioSkipLabel}>10</span>
              </button>
              <button
                className={styles.audioPlay}
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
              <button className={styles.audioSkip} type="button" aria-label="Forward 10s">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                <span className={styles.audioSkipLabel}>10</span>
              </button>
              <button className={styles.audioSpeed} type="button">
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
