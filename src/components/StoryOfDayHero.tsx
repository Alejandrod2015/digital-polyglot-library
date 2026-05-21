"use client";

import Link from "next/link";
import { Play, Bookmark } from "lucide-react";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";
import RegionBadge from "@/components/RegionBadge";

type Plan = "free" | "basic" | "premium" | "polyglot";

type Story = {
  href: string;            // /stories/{slug} or /story-of-the-day
  title: string;
  bookTitle: string;       // "Colombian Spanish Stories for Beginners"
  coverUrl: string;        // REQUIRED — full URL or absolute path
  description?: string;
  level?: string;
  language?: string;
  region?: string;
  topic?: string;
  durationMin?: number;
  newWords?: number;
  chapters?: number;
};

type Props = {
  story: Story;
  plan: Plan;
};

/** Trim long book descriptions to ~2 sentences so the hero stays
 *  scannable instead of becoming a wall of text on wide screens. */
function trimDescription(raw: string, maxChars = 200): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > maxChars && out.length > 60) break;
    out += s;
  }
  if (!out) out = clean.slice(0, maxChars);
  return out.trim().endsWith(".") ? out.trim() : `${out.trim()}…`;
}

/**
 * STORY OF THE DAY HERO — the editorial 2-column layout.
 *
 * Layout contract:
 *   - `grid grid-cols-[1.05fr_1fr]` on desktop ≥ 980px → IMAGE LEFT, BODY RIGHT
 *   - Single column on mobile (image becomes a banner on top, capped via
 *     dp-hero-img-cap so it doesn't dominate)
 *   - The section is HEIGHT-CAPPED so wide viewports don't blow the
 *     16:9 image up to full-screen. The image cell flexes to fill the
 *     capped section height with object-cover (cropping wider covers).
 */
export default function StoryOfDayHero({ story, plan }: Props) {
  const isFree = plan === "free" || plan === "basic";

  // Time until midnight local (for the free-today countdown).
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = midnight.getTime() - now.getTime();
  const h = Math.max(0, Math.floor(diffMs / 3600000));
  const m = Math.max(0, Math.floor((diffMs % 3600000) / 60000));

  return (
    <section
      // Layout en `dp-sotd-hero` (globals.css): 1 col en móvil (imagen
      // como banner arriba, texto debajo), 2 cols en desktop con la
      // imagen a la izquierda y cap de altura 360–440px. Sólo el
      // padding del card va inline.
      className="dp-sotd-hero relative rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden"
      style={{ padding: 16 }}
    >
      {/* ────── LEFT: image ────── */}
      {/* Aspect 16/9 en móvil para que se vea como banner editorial.
          En desktop el grid le impone su propia altura, así que el
          aspect-ratio se desactiva con `md:` (rescue class). */}
      <div
        className="dp-sotd-img relative bg-[var(--surface)] rounded-2xl overflow-hidden"
        style={{ aspectRatio: "16 / 9" }}
      >
        <img
          src={story.coverUrl}
          alt={story.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {isFree && (
          <div className="absolute top-4 right-4 flex items-center gap-2 pl-1.5 pr-3.5 py-1 rounded-full bg-[rgba(11,30,54,0.78)] backdrop-blur border border-[var(--chip-border)] text-[var(--chip-text)] text-xs font-bold whitespace-nowrap">
            <span className="bg-[var(--color-gold)] text-[#2a1a02] px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-[0.06em]">
              Free today
            </span>
            <span>
              resets in {h}h {m}m
            </span>
          </div>
        )}
      </div>

      {/* ────── RIGHT: body ────── */}
      <div
        className="flex flex-col justify-center gap-3 overflow-hidden"
        style={{ paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}
      >
        <span className="text-[11px] font-extrabold tracking-[0.16em] uppercase text-[var(--color-gold)] whitespace-nowrap self-start">
          Story of the day
        </span>

        <h1
          className="text-[30px] font-black tracking-[-0.025em] leading-[1.05] text-[var(--foreground)] m-0"
          style={{ textWrap: "balance" }}
        >
          {story.title}
        </h1>

        <div className="text-[13px] font-extrabold text-[var(--color-gold)]">
          {story.bookTitle}
        </div>

        {story.description && (
          <p
            className="text-[13.5px] font-semibold leading-[1.5] text-[var(--muted)] max-w-[52ch] m-0 overflow-hidden"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            {trimDescription(story.description)}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          <LevelBadge level={story.level} />
          <LanguageBadge language={story.language} />
          <RegionBadge region={story.region} />
          {story.topic && (
            <span className="inline-flex items-center h-[22px] px-2.5 rounded-full bg-[var(--chip-bg)] border border-[var(--chip-border)] text-[var(--chip-text)] text-[11px] font-bold whitespace-nowrap">
              {story.topic}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-6 pt-1 text-xs font-bold text-[var(--muted)]">
          {story.durationMin != null && (
            <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              <strong className="text-[17px] font-black tracking-[-0.015em] text-[var(--foreground)]">
                {story.durationMin} min
              </strong>
              runtime
            </span>
          )}
          {story.newWords != null && (
            <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              <strong className="text-[17px] font-black tracking-[-0.015em] text-[var(--foreground)]">
                {story.newWords}
              </strong>
              new words
            </span>
          )}
          {story.chapters != null && (
            <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
              <strong className="text-[17px] font-black tracking-[-0.015em] text-[var(--foreground)]">
                {story.chapters}
              </strong>
              chapters
            </span>
          )}
        </div>

        <div className="flex gap-2.5 mt-1.5 flex-wrap">
          <Link
            href={story.href}
            className="inline-flex items-center gap-2 px-[18px] py-3 rounded-full bg-[var(--color-gold)] text-[#2a1a02] text-sm font-extrabold whitespace-nowrap hover:bg-[#f59e0b] transition-all hover:-translate-y-0.5"
          >
            <Play size={14} fill="currentColor" />
            Listen now
          </Link>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-[18px] py-3 rounded-full bg-[var(--chip-bg)] text-[var(--foreground)] border border-[var(--chip-border)] text-sm font-extrabold whitespace-nowrap hover:bg-[var(--card-bg-hover)] transition-all hover:-translate-y-0.5"
          >
            <Bookmark size={16} />
            Save
          </button>
        </div>
      </div>
    </section>
  );
}
