"use client";

import { Check, Lock, Play } from "lucide-react";

export type StoryNodeState = "done" | "next" | "available" | "locked";

type Story = {
  /** Where the card navigates. */
  href: string;
  /** Display title shown on the card. */
  title: string;
  /** Optional cover URL. If missing, the topic-color gradient fills the thumbnail. */
  coverUrl?: string;
  /** Optional emoji fallback (rendered on top of the gradient if no cover). */
  icon?: string;
  /** State drives the visual treatment. See JOURNEY HANDOFF §"States". */
  state: StoryNodeState;
};

type Props = {
  story: Story;
  /** Topic color from TOPIC_PALETTE. Used for active background + thumb fallback gradient. */
  color: string;
  /** Wave offset in pixels (left margin). See offsetAt() in Journey.example.tsx. */
  waveOffset: number;
};

/**
 * STORY NODE CARD; wide rounded card with thumbnail · title · check circle.
 *
 * iPhone reference: the zigzag story rows. Match four visual states:
 *   - done:      cyan-filled check circle
 *   - next:      active highlight (topic-color bg, white check, pulsing halo)
 *   - available: empty circle with dim outline check
 *   - locked:    faded, lock icon, disabled
 *
 * ⚠️ Visual contract:
 *   - 3D button effect via box-shadow (inset highlight + 4px dark stack).
 *     Pressed: shrinks stack and translates +3px.
 *   - Active card gets a pulsing halo via the `::before` pseudo-element
 *     (defined in globals.css under `.dp-journey-card.active::before`).
 */
export default function JourneyStoryCard({ story, color, waveOffset }: Props) {
  const active = story.state === "next";
  const disabled = story.state === "locked";

  const checkContent = {
    done:      <Check size={14} strokeWidth={3}/>,
    next:      <Check size={14} strokeWidth={3}/>,
    available: <Check size={14} strokeWidth={2.5}/>,
    locked:    <Lock size={13} strokeWidth={2.5}/>,
  }[story.state];

  return (
    <div
      className="flex items-center mb-[18px]"
      style={{ paddingLeft: `${waveOffset}px` }}
      // Used by the yellow "scroll to next" FAB on JourneyClient to
      // locate the active card via querySelector. Only the single
      // global next-story row carries this attribute.
      data-journey-next={active ? "true" : undefined}
    >
      <a
        href={disabled ? undefined : story.href}
        aria-disabled={disabled}
        className={[
          "dp-journey-card",
          "group flex items-center gap-4 p-3 pr-[18px] rounded-[22px] w-full max-w-[440px] min-w-0 cursor-pointer relative",
          "transition-[filter,transform] duration-75",
          disabled ? "opacity-55 cursor-not-allowed" : "hover:[filter:brightness(1.10)] active:translate-y-[3px]",
          active ? "active-card" : "",
        ].join(" ")}
        style={{
          background: active ? color : "var(--bg-1)",
          // `--tp-color` exposes the topic color to the ::before halo defined in globals.css
          "--tp-color": color,
        } as React.CSSProperties}
      >
        {/* Thumbnail */}
        <div
          className="w-16 h-16 rounded-[16px] overflow-hidden relative shrink-0 grid place-items-center text-[28px]"
          style={{
            background: story.coverUrl
              ? "var(--surface)"
              : `linear-gradient(135deg, ${color} 0%, ${color}aa 50%, ${color}55 100%)`,
          }}
        >
          {story.coverUrl ? (
            <img src={story.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover"/>
          ) : (
            <span>{story.icon ?? "📖"}</span>
          )}
        </div>

        {/* Title. Cuando la card está activa, vive sobre un fondo de
            color saturado (azul/coral/etc). En light mode el override
            global `.text-white → foreground dark` ennegrecería el
            título; inline `color: #ffffff` lo evita y mantiene
            paridad con dark. */}
        <span
          className="flex-1 min-w-0 text-[18px] font-black leading-tight tracking-[-0.015em] line-clamp-2"
          style={{
            textWrap: "balance",
            color: active ? "#ffffff" : "var(--foreground)",
          } as React.CSSProperties}
        >
          {story.title}
        </span>

        {/* Check / lock circle. Mismo problema: en card activa el
            check vive sobre azul; forzamos blanco inline para que el
            override global no lo ennegrezca en light. */}
        <span
          className={[
            "w-8 h-8 rounded-full grid place-items-center shrink-0 transition-colors border-2",
            story.state === "done"      ? "bg-[var(--color-cyan)] border-[var(--color-cyan)] [box-shadow:0_0_0_2px_rgba(125,211,252,0.20)]" : "",
            story.state === "next"      ? "" : "",
            story.state === "available" ? "border-[var(--card-border)]" : "",
            story.state === "locked"    ? "border-[var(--card-border)]" : "",
          ].join(" ")}
          style={
            story.state === "done"
              ? { color: "#082f49" }
              : story.state === "next"
                ? {
                    background: "rgba(255,255,255,0.2)",
                    borderColor: "rgba(255,255,255,0.3)",
                    color: "#ffffff",
                  }
                : story.state === "available"
                  ? { color: active ? "rgba(255,255,255,0.85)" : "var(--muted)" }
                  : story.state === "locked"
                    ? { color: active ? "rgba(255,255,255,0.45)" : "rgba(120,120,128,0.5)" }
                    : undefined
          }
        >
          {checkContent}
        </span>
      </a>
    </div>
  );
}
