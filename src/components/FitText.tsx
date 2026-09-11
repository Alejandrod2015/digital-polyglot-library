"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type FitTextProps = {
  children: ReactNode;
  /** Classes for the text itself. Its CSS font-size is the ceiling. */
  className?: string;
  /** Classes for the box the text has to fit in (e.g. padding to keep clear of an overlay). */
  boxClassName?: string;
  /** Floor for the shrink, in px. Below it the box clips instead. */
  minPx?: number;
  /**
   * "anywhere": lines may break inside a word at any size (prose, glosses).
   * "words": lines break only between words; a long word shrinks the font
   * instead of splitting, and only splits once the floor is reached.
   */
  wrap?: "anywhere" | "words";
};

/**
 * Fills its parent and shrinks the text's font-size until it fits inside,
 * never growing past the size the CSS gives it. Built for cards that live in
 * a flex-to-fit grid (practice Match): the card's height comes from the grid,
 * not from the text, so the text has to adapt to the card and not the other
 * way round. The parent needs a definite height (h-full in a grid row works).
 */
export default function FitText({
  children,
  className = "",
  boxClassName = "",
  minPx = 11,
  wrap = "anywhere",
}: FitTextProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  const fit = useCallback(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;
    text.style.fontSize = "";
    text.style.overflowWrap = "";
    // clientWidth/Height include the box's padding; the text may only use what is inside it.
    const boxStyle = getComputedStyle(box);
    const innerW = box.clientWidth - parseFloat(boxStyle.paddingLeft) - parseFloat(boxStyle.paddingRight);
    const innerH = box.clientHeight - parseFloat(boxStyle.paddingTop) - parseFloat(boxStyle.paddingBottom);
    const fits = () => text.scrollHeight <= innerH + 0.5 && text.scrollWidth <= innerW + 0.5;
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
    // At the floor a word still wider than the box: splitting it beats clipping it.
    if (wrap === "words" && !fits()) text.style.overflowWrap = "anywhere";
  }, [minPx, wrap]);

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

  const wrapClass = wrap === "words" ? "[overflow-wrap:normal] [word-break:normal]" : "[overflow-wrap:anywhere]";

  return (
    <div
      ref={boxRef}
      className={`flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden ${boxClassName}`}
    >
      <p ref={textRef} className={`${wrapClass} ${className}`}>
        {children}
      </p>
    </div>
  );
}
