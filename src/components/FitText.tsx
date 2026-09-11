"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type FitTextProps = {
  children: ReactNode;
  /** Classes for the text itself. Its CSS font-size is the ceiling. */
  className?: string;
  /** Floor for the shrink, in px. Below it the box clips instead. */
  minPx?: number;
};

/**
 * Fills its parent and shrinks the text's font-size until it fits inside,
 * never growing past the size the CSS gives it. Built for cards that live in
 * a flex-to-fit grid (practice Match): the card's height comes from the grid,
 * not from the text, so the text has to adapt to the card and not the other
 * way round. The parent needs a definite height (h-full in a grid row works).
 */
export default function FitText({ children, className = "", minPx = 11 }: FitTextProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  const fit = useCallback(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;
    text.style.fontSize = "";
    const fits = () =>
      text.scrollHeight <= box.clientHeight + 0.5 && text.scrollWidth <= box.clientWidth + 0.5;
    if (fits()) return;
    const maxPx = parseFloat(getComputedStyle(text).fontSize);
    let lo = minPx;
    let hi = maxPx;
    for (let i = 0; i < 8; i += 1) {
      const mid = (lo + hi) / 2;
      text.style.fontSize = `${mid}px`;
      if (fits()) lo = mid;
      else hi = mid;
    }
    text.style.fontSize = `${lo}px`;
  }, [minPx]);

  useIsoLayoutEffect(() => {
    fit();
  }, [fit, children]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(box);
    void document.fonts?.ready.then(() => fit());
    return () => observer.disconnect();
  }, [fit]);

  return (
    <div ref={boxRef} className="flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden">
      <p ref={textRef} className={`[overflow-wrap:anywhere] ${className}`}>
        {children}
      </p>
    </div>
  );
}
