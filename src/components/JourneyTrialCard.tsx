"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * Tarjeta de prueba que ve un usuario basic al terminar su tema gratis
 * (2026-09-14). Es el momento de mas intencion: acaba de leer tres historias
 * y el siguiente tema del mapa ya sale con candado. Lleva a /plans, donde
 * Stripe abre la prueba de 7 dias (`trial_period_days: 7`).
 */
export default function JourneyTrialCard() {
  return (
    <div
      className="mb-8 flex w-full max-w-[440px] flex-col gap-3 rounded-[22px] border p-5"
      style={{ background: "var(--card-bg)", borderColor: "var(--color-gold)" }}
    >
      <span
        className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em]"
        style={{ color: "var(--color-gold)" }}
      >
        <Sparkles size={14} />
        Free topic complete
      </span>
      <p className="text-[18px] font-black leading-tight" style={{ color: "var(--foreground)" }}>
        Keep going with the rest of your journey
      </p>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Every topic, with audio and practice. Free for 7 days, cancel anytime.
      </p>
      <Link
        href="/plans"
        className="mt-1 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-sm font-extrabold tracking-wide hover:brightness-105"
        style={{ background: "var(--color-gold)", color: "var(--color-gold-ink)" }}
      >
        Start 7-day free trial
      </Link>
    </div>
  );
}
