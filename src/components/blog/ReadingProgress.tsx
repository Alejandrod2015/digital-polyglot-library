"use client";

// Sticky horizontal bar at the top of the viewport that fills as the reader
// scrolls through the article. Tracks the bounding box of the wrapped
// element (the `.post` block) so the percentage is anchored to the actual
// content, not the whole page height (which includes the footer + nav).

import { useEffect, useState } from "react";

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const compute = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      if (total <= 0) {
        setProgress(0);
        return;
      }
      const pct = Math.min(100, Math.max(0, (window.scrollY / total) * 100));
      setProgress(pct);
    };

    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 60,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 25,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, #fcd34d, #fb923c)",
          transition: "width 0.08s linear",
        }}
      />
    </div>
  );
}
