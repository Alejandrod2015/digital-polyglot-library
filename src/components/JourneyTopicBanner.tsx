"use client";

import { List } from "lucide-react";
import { formatCefrDisplay } from "@domain/cefr";

type Props = {
  /** Level code ("a1", "A1", …). Rendered as a friendly label eyebrow. */
  levelId: string;
  /** Topic title shown as the big banner text. */
  title: string;
  /** Topic color from TOPIC_PALETTE (see Journey.example.tsx). */
  color: string;
  /** Greys out the banner and disables press states. */
  locked?: boolean;
  /** Tapped → open the topic detail (e.g. stories list / topic preview sheet). */
  onTap?: () => void;
};

/**
 * TOPIC BANNER; the big colored "LEVEL A1 / Food & Drink" header card.
 *
 * iPhone reference: `journeyTopicPanel` + `journeyTopicPanelBevel`.
 *
 * ⚠️ Visual contract:
 *   - 3D button feel via box-shadow (inset highlight top + 5px dark
 *     stack below). Pressed state shrinks the stack 5px→2px and
 *     translates +3px so the button reads as physically depressed.
 *   - When locked, background is forced to `#3b4a66` regardless of
 *     the passed color.
 */
export default function JourneyTopicBanner({
  levelId, title, color, locked, onTap,
}: Props) {
  const bg = locked ? "#3b4a66" : color;

  // Banner vive sobre un fondo de color saturado (azul/coral/etc).
  // En light mode el override global `.text-white → foreground dark`
  // ennegrece el título sobre el azul. Inline `color` lo evita
  // forzando blanco en ambos temas.
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onTap}
      style={{ backgroundColor: bg }}
      className="dp-journey-banner group"
    >
      <div className="flex-1 min-w-0 flex flex-col gap-1 text-left">
        <span
          className="text-[11px] font-black tracking-[0.16em] uppercase"
          style={{ color: locked ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.8)" }}
        >
          {formatCefrDisplay(levelId)}{locked ? " · Locked" : ""}
        </span>
        <span
          className="text-[28px] font-black tracking-[-0.02em] leading-[1.1]"
          style={{
            color: locked ? "rgba(255,255,255,0.55)" : "#ffffff",
            textShadow: locked ? "none" : "0 2px 8px rgba(0,0,0,0.12)",
          }}
        >
          {title}
        </span>
      </div>
      <span
        className="w-11 h-11 rounded-[14px] grid place-items-center shrink-0 transition-colors"
        style={{ background: "rgba(255,255,255,0.16)", color: "#ffffff" }}
      >
        <List size={22} />
      </span>
    </button>
  );
}
