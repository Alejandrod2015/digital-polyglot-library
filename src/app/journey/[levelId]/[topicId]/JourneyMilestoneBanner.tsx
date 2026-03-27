"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { JOURNEY_MILESTONE_CHIME_URI } from "@/lib/journeyMilestone";

type JourneyMilestoneBannerProps = {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
};

export default function JourneyMilestoneBanner({
  eyebrow,
  title,
  body,
  cta,
  href,
}: JourneyMilestoneBannerProps) {
  useEffect(() => {
    const audio = new Audio(JOURNEY_MILESTONE_CHIME_URI);
    audio.volume = 0.22;
    void audio.play().catch(() => {});
    return () => {
      audio.pause();
    };
  }, [eyebrow, title, body, cta, href]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 20 }}
      className="mb-3 overflow-hidden rounded-[1.35rem] border border-emerald-200/20 bg-emerald-300/10 px-4 py-4"
    >
      {[
        { left: "10%", top: 18, color: "#fde68a", dx: -12, dy: -12 },
        { left: "16%", top: 50, color: "#86efac", dx: -8, dy: -20 },
        { left: "82%", top: 24, color: "#7dd3fc", dx: 12, dy: -10 },
        { left: "90%", top: 56, color: "#fde68a", dx: 14, dy: 6 },
      ].map((particle, index) => (
        <motion.span
          key={`${title}-${index}`}
          initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0.6, 1, 0.7], x: particle.dx, y: particle.dy }}
          transition={{ duration: 0.9, delay: index * 0.05, ease: "easeOut" }}
          className="pointer-events-none absolute h-2.5 w-2.5 rounded-full"
          style={{ left: particle.left, top: particle.top, backgroundColor: particle.color }}
        />
      ))}
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-100/80">{eyebrow}</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-200" />
            <p className="text-xl font-black tracking-tight text-white">{title}</p>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-emerald-50/88">{body}</p>
        </div>
        <Link
          href={href}
          className="inline-flex w-fit rounded-full border border-emerald-200/20 bg-emerald-300/15 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-50 hover:bg-emerald-300/20"
        >
          {cta}
        </Link>
      </div>
    </motion.div>
  );
}
