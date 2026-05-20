"use client";

import { useEffect, useMemo, useState } from "react";

const PALETTE = ["#fcd34d", "#7dd3fc", "#fcd34d", "#f0abfc", "#fb923c", "#86efac"];
const PARTICLE_COUNT = 28;

type Particle = {
  startX: number;
  endYRatio: number;
  delayMs: number;
  durationMs: number;
  rotateTo: number;
  color: string;
  size: number;
  driftX: number;
};

function buildParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const dir = i % 2 === 0 ? -1 : 1;
    return {
      startX: Math.random() * 100,
      endYRatio: 55 + Math.random() * 40,
      delayMs: Math.random() * 250,
      durationMs: 4000 + Math.random() * 1500,
      rotateTo: dir * (180 + Math.random() * 360),
      color: PALETTE[i % PALETTE.length] ?? "#fcd34d",
      size: 6 + Math.random() * 6,
      driftX: dir * (30 + Math.random() * 60),
    };
  });
}

/**
 * Pure-CSS confetti burst rendered on top of a celebration panel. Mirrors
 * the mobile PracticeCelebration: 28 particles fall, rotate and fade. The
 * container is pointer-events none so taps fall through.
 */
export function Confetti({ active }: { active: boolean }) {
  const [mounted, setMounted] = useState(false);
  const particles = useMemo(() => buildParticles(), []);

  useEffect(() => {
    if (active) setMounted(true);
  }, [active]);

  if (!active && !mounted) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {particles.map((particle, index) => (
        <span
          key={index}
          className="absolute"
          style={{
            left: `${particle.startX}%`,
            top: 0,
            width: `${particle.size}px`,
            height: `${particle.size * 1.6}px`,
            backgroundColor: particle.color,
            borderRadius: 2,
            opacity: 0,
            transform: "translate3d(0, -30px, 0)",
            animation: active
              ? `confetti-fall-${index} ${particle.durationMs}ms cubic-bezier(0.16,0.84,0.44,1) ${particle.delayMs}ms forwards`
              : undefined,
          }}
        />
      ))}
      <style jsx>{`
        ${particles
          .map(
            (p, i) => `
          @keyframes confetti-fall-${i} {
            0% { opacity: 0; transform: translate3d(0, -30px, 0) rotate(0deg); }
            10% { opacity: 1; }
            85% { opacity: 1; }
            100% {
              opacity: 0;
              transform: translate3d(${p.driftX}px, ${p.endYRatio}vh, 0) rotate(${p.rotateTo}deg);
            }
          }
        `,
          )
          .join("\n")}
      `}</style>
    </div>
  );
}
