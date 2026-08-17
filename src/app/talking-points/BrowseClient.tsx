"use client";

// BROWSE; variant C, "angle-first grid" (chosen 2026-08-05 from the three
// proposals in public/tp-variants.html).
//
// No order, no locks, no "next", no completion counter. A piece is either read
// or not read, which is a record rather than a ladder. See ./page.tsx for why
// the journey path was removed.
//
// The primary axis is the ANGLE (Explainer / Both sides / Portrait), not the
// category: it is the axis that tells the user something they cannot guess
// from the title, and it teaches them that three formats exist. Category is a
// secondary filter, one row down and visually lighter.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import Flag from "@/components/Flag";
import {
  TALKING_CATEGORIES,
  type CategoryId,
  type TalkingEntry,
} from "@/lib/talkingPoints";
import { loadRead } from "@/lib/talkingPointsRun";

type Angle = "explainer" | "debate" | "portrait";

// The angle colour is the card's only chrome, so these three are load-bearing,
// not decoration. Kept in the same family as the journey topic palette.
const ANGLE: Record<Angle, { label: string; color: string; tint: string }> = {
  explainer: { label: "Explainer", color: "#5aa9f8", tint: "rgba(90,169,248,.16)" },
  debate: { label: "Both sides", color: "#ffab3d", tint: "rgba(255,171,61,.16)" },
  portrait: { label: "Portrait", color: "#bd8bf0", tint: "rgba(189,139,240,.16)" },
};

const ANGLE_ORDER: Angle[] = ["explainer", "debate", "portrait"];

export default function BrowseClient({ entries }: { entries: TalkingEntry[] }) {
  const [read, setRead] = useState<string[]>([]);
  const [angle, setAngle] = useState<Angle | "all">("all");
  const [category, setCategory] = useState<CategoryId | "all">("all");

  useEffect(() => {
    setRead(loadRead());
  }, []);

  const visible = useMemo(
    () =>
      entries.filter(
        (e) =>
          (angle === "all" || e.piece.angle === angle) &&
          (category === "all" || e.topic.categoryId === category)
      ),
    [entries, angle, category]
  );

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 pt-8 pb-24">
      <header className="mb-5">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--color-gold)]">
          Talking Points
        </p>
        <h1 className="mt-1.5 text-[30px] leading-[1.1] font-black tracking-[-0.03em] text-[var(--foreground)] m-0">
          What Spain is arguing about
        </h1>
        <p className="mt-2.5 text-[14px] font-bold text-[var(--muted)] max-w-[50ch]">
          Short non-fiction in Spanish. Two to three minutes each. Read whatever
          you like, in any order.
        </p>
      </header>

      {/* Primary filter: the angle. */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
        {(["all", ...ANGLE_ORDER] as const).map((key) => {
          const on = angle === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setAngle(key)}
              aria-pressed={on}
              className={[
                "shrink-0 rounded-full border px-4 py-2 text-[12px] font-black transition-colors",
                on
                  ? "border-[var(--color-gold)] bg-[var(--color-gold)] text-[#0b1220]"
                  : "border-[var(--card-border)] text-[var(--muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              {key === "all" ? "All" : ANGLE[key].label}
            </button>
          );
        })}
      </div>

      {/* Secondary filter: the category. Lighter on purpose. */}
      <div className="mt-2 flex gap-4 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
        {[{ id: "all" as const, label: "All topics" }, ...TALKING_CATEGORIES].map((c) => {
          const on = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              aria-pressed={on}
              className={[
                "shrink-0 text-[12px] font-extrabold whitespace-nowrap pb-1 border-b-2 transition-colors",
                on
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <ul className="list-none p-0 mt-5 mb-0 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {visible.map((entry) => (
          <li key={entry.piece.slug}>
            <PieceCard entry={entry} read={read.includes(entry.piece.slug)} />
          </li>
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="mt-10 text-center text-[14px] font-bold text-[var(--muted)]">
          Nothing in that combination yet.
        </p>
      )}
    </div>
  );
}

function PieceCard({ entry, read }: { entry: TalkingEntry; read: boolean }) {
  const { topic, piece } = entry;
  const a = ANGLE[piece.angle as Angle] ?? ANGLE.explainer;
  const written = piece.body.length > 0;

  return (
    <Link href={`/talking-points/piece/${piece.slug}`} className="block h-full no-underline">
      <article
        className={[
          "flex h-full min-h-[164px] flex-col rounded-2xl p-3.5 transition-colors",
          written
            ? "bg-[var(--bg-1)] hover:bg-[var(--bg-2)]"
            : "bg-transparent border border-dashed border-[var(--card-border)]",
        ].join(" ")}
        // The colour bar IS the card's chrome. Everything else is type.
        style={{ borderLeft: `4px solid ${written ? a.color : "var(--card-border)"}` }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-[0.09em]"
            style={{ background: a.tint, color: a.color }}
          >
            {a.label}
          </span>
          <Flag code={topic.country} size={13} title={topic.country} />
          {read && (
            <span
              className="ml-auto grid h-[18px] w-[18px] place-items-center rounded-full bg-[#5dd9e8] text-[#06283d]"
              title="Read"
            >
              <Check size={11} strokeWidth={3} aria-hidden />
            </span>
          )}
        </div>

        {/* Slightly larger than the mockup's 14.5px: at 2 columns the question
            is still the thing being read, so it gets the extra half-step. */}
        <h3
          className={[
            "mt-2.5 mb-1.5 text-[15.5px] leading-[1.28] font-black tracking-[-0.01em]",
            written ? "text-[var(--foreground)]" : "text-[var(--muted)]",
          ].join(" ")}
        >
          {piece.title}
        </h3>

        <p className="m-0 text-[11.5px] leading-[1.35] font-bold text-[var(--muted)]">
          {piece.hook}
        </p>

        <p className="mt-auto pt-2.5 mb-0 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--muted)]">
          {written ? topic.label : "Not written yet"}
        </p>
      </article>
    </Link>
  );
}
