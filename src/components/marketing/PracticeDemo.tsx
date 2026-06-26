"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LandingPage.module.css";

/**
 * Word Quest "Meaning" exercise demo; mirrors the real mobile screen.
 * Word in Spanish, 4 English definitions, animated cursor that sweeps
 * the cards and settles on the correct (green-accented) answer.
 *
 * Layout one-to-one with src/app/practice (Meaning exercise type):
 *  - Header: back, WORD QUEST kicker + "Meaning" title, yellow timer pill
 *  - Yellow horizontal progress bar
 *  - 8 step dots (first done in green)
 *  - 3 pills: WORD QUEST tag, +6 XP, 1 gem
 *  - Question prompt, big bold word, audio button, yellow underline
 *  - 2x2 grid of definition cards, each with a colored top accent
 *  - Bottom "PICK AN ANSWER" button (activates on selection)
 */

type Stage = "idle" | "hover" | "tap" | "confirm";

const WORD = "fonda";
const QUESTION = "What does this word mean?";
type Color = "yellow" | "blue" | "purple" | "green";
const OPTIONS: Array<{ id: string; color: Color; text: string }> = [
  { id: "decoy_market", color: "yellow", text: "A bag carried over the shoulder when going to the market." },
  { id: "decoy_pot", color: "blue", text: "The deep back or bottom of a clay cooking pot." },
  { id: "decoy_prayer", color: "purple", text: "A short morning prayer said before breakfast." },
  { id: "correct", color: "green", text: "A small, family-run Mexican restaurant serving home-style food." },
];
const CORRECT_ID = "correct";
const LOOP = 8;

export default function PracticeDemo() {
  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const [t, setT] = useState(prefersReduced ? 6 : 0);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReduced) return;
    const tick = (now: number) => {
      if (last.current == null) last.current = now;
      const dt = (now - last.current) / 1000;
      last.current = now;
      setT((p) => (p + dt > LOOP ? 0 : p + dt));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [prefersReduced]);

  let stage: Stage = "idle";
  if (t >= 6.0) stage = "confirm";
  else if (t >= 5.0) stage = "tap";
  else if (t >= 1.5) stage = "hover";

  // Cursor visits 0 → 1 → 2 → 3 (settles on correct=3, bottom-right).
  const cursorIdx = (() => {
    if (stage === "idle") return 0;
    if (stage === "hover") {
      const p = Math.min(1, (t - 1.5) / 3.4);
      const path = [0, 1, 2, 3];
      return path[Math.min(path.length - 1, Math.floor(p * path.length))];
    }
    return 3;
  })();

  const selectedId = stage === "tap" || stage === "confirm" ? CORRECT_ID : null;
  const hoverId = stage === "hover" ? OPTIONS[cursorIdx].id : null;
  const timerLeft = Math.max(1, 7 - Math.floor(t));
  const progressPct = 12 + (t / LOOP) * 5;

  return (
    <div className={styles.phoneStage} aria-hidden="true">
      <div className={styles.phone}>
        <div className={styles.phoneNotch} />
        <div className={styles.phoneStatus}>
          <span>13:55</span>
          <div className={styles.statusIcons}>
            <svg width="13" height="10" viewBox="0 0 13 10" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M1 3.5 a7 7 0 0 1 11 0M2.6 5.6 a4.5 4.5 0 0 1 7.8 0M4.4 7.7 a2.2 2.2 0 0 1 4.2 0" strokeLinecap="round" />
            </svg>
            <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
              <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" opacity="0.45" />
              <rect x="2" y="2" width="15" height="7" rx="1.5" fill="currentColor" />
              <path d="M20 4 v3" stroke="currentColor" opacity="0.45" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        <div className={styles.phoneScreen}>
          <div className={styles.wqHeader}>
            <button className={styles.wqBack} type="button" aria-label="Back">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className={styles.wqTitleCol}>
              <span className={styles.wqKicker}>WORD QUEST</span>
              <h2 className={styles.wqTitle}>Meaning</h2>
            </div>
            <span className={styles.wqTimer}>{timerLeft}s</span>
          </div>

          <div className={styles.wqProgress}>
            <div
              className={styles.wqProgressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className={styles.wqSteps}>
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={i}
                className={`${styles.wqStep} ${i === 0 ? styles.wqStepDone : ""}`}
              />
            ))}
          </div>

          <div className={styles.wqTags}>
            <span className={styles.wqTagQuest}>
              <span className={styles.wqTagDot} />
              WORD QUEST
            </span>
            <span className={styles.wqTagSpacer} />
            <span className={styles.wqTagXp}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2 L4 14 h7 l-1 8 9-12 h-7 z" />
              </svg>
              +6
            </span>
            <span className={styles.wqTagGem}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 9 L12 2 L18 9 L12 22 z" />
              </svg>
              1
            </span>
          </div>

          <p className={styles.wqQuestion}>{QUESTION}</p>

          <div className={styles.wqWordRow}>
            <h1 className={styles.wqWord}>{WORD}</h1>
            <button className={styles.wqAudio} type="button" aria-label="Play audio">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </button>
          </div>
          <div className={styles.wqUnderline} />

          <div className={styles.wqGrid}>
            {OPTIONS.map((opt) => {
              const isHover = hoverId === opt.id;
              const isSelected = selectedId === opt.id;
              return (
                <div
                  key={opt.id}
                  className={[
                    styles.wqCard,
                    isHover ? styles.wqCardHover : "",
                    isSelected ? styles.wqCardSelected : "",
                  ].filter(Boolean).join(" ")}
                >
                  <span className={`${styles.wqAccent} ${styles[`wqAccent_${opt.color}`]}`} />
                  <p className={styles.wqCardText}>{opt.text}</p>
                </div>
              );
            })}

            {(stage === "hover" || stage === "tap") && (
              <div
                className={styles.wqCursor}
                style={{
                  left: `calc(${(cursorIdx % 2) * 50 + 25}% - 10px)`,
                  top: `calc(${Math.floor(cursorIdx / 2) * 50 + 25}% - 10px)`,
                  transform: stage === "tap" ? "scale(0.85)" : "scale(1)",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 3l14 9-6 1-1 6L5 3z" />
                </svg>
              </div>
            )}
          </div>

          <div className={styles.wqBottom}>
            <button
              className={selectedId ? styles.wqBtnActive : styles.wqBtnDisabled}
              type="button"
            >
              {stage === "confirm" ? "✓ CORRECT" : "PICK AN ANSWER"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
