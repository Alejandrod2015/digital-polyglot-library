// /src/app/story-of-the-week/page.tsx
//
// Mismo layout que /story-of-the-day para que ambas surfaces se sientan
// como hermanas (free → semana, basic+ → día). Diferencias mínimas:
// eyebrow "Story of the week", icono CalendarDays en vez de Sparkles,
// label "This week" en vez de la fecha de hoy, y la copy del CTA y
// footer adaptada a la cadencia semanal.

import { getFeaturedStory, getFeaturedStoryDataBySlug } from "@/lib/getFeaturedStory";
import Link from "next/link";
import Image from "next/image";
import { Play, Crown, CalendarDays } from "lucide-react";
import { formatLanguage, formatLevel, formatTopic, toTitleCase } from "@domain/displayFormat";
import { shouldBypassImageOptimization } from "@/lib/publicMedia";

export const revalidate = 3600;

// Trim the giant book description to ~2 sentences so the hero stays
// scannable. Keeps full stops, ellipsizes if truncated.
function trimDescription(raw: string, maxChars = 220): string {
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

export default async function StoryOfTheWeekPage() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const featured = await getFeaturedStory("week", tz);

  if (!featured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-8 text-[var(--foreground)]">
        <p className="text-[var(--muted)]">No featured story for this week.</p>
        <Link
          href="/explore"
          className="mt-6 inline-flex rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-extrabold text-[#2a1a02] hover:brightness-105"
        >
          Browse stories
        </Link>
      </div>
    );
  }

  const story = getFeaturedStoryDataBySlug(featured.slug);

  if (!story || !story.book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-8 text-[var(--foreground)]">
        <p className="text-[var(--muted)]">Could not load this week&apos;s story.</p>
        <Link
          href="/explore"
          className="mt-6 inline-flex rounded-full bg-[var(--color-gold)] px-5 py-2.5 text-sm font-extrabold text-[#2a1a02] hover:brightness-105"
        >
          Browse stories
        </Link>
      </div>
    );
  }

  const book = story.book;
  const coverUrl = book.cover || "/covers/default.jpg";
  const unoptimizedCover = shouldBypassImageOptimization(coverUrl);
  // Week label: "May 22 — May 28" or similar, anchored to the current
  // week (Mon→Sun). Falls back to plain month label if computation
  // glitches. Mantiene una unidad temporal visible como el "today" en
  // story-of-the-day.
  const weekLabel = (() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Mon
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${monday.toLocaleDateString("en-US", opts)} — ${sunday.toLocaleDateString("en-US", opts)}`;
  })();
  const description = trimDescription(
    book.description ||
      `A story from "${book.title}" that invites you to explore language and culture through authentic storytelling.`,
  );

  return (
    <div className="px-4 pb-24 pt-8 sm:px-8 mx-auto text-[var(--foreground)]" style={{ maxWidth: 720 }}>
      {/* ── Top tag row ── */}
      <div className="flex items-baseline justify-between mb-4">
        {/* Eyebrow + label usan tokens semánticos para que en light
            mode auto-mapeen a deep amber + warm muted. Antes el hex
            #fcd34d se veía lavado sobre cream. */}
        <p className="inline-flex items-center gap-1.5 text-[var(--color-gold)] text-[11px] font-extrabold uppercase tracking-[0.28em]">
          <CalendarDays size={12} strokeWidth={2.6} />
          Story of the week
        </p>
        <span className="text-[12px] font-bold text-[var(--muted)]">{weekLabel}</span>
      </div>

      {/* ── Hero cover (wide, 16:9, full-bleed at top of card) ── */}
      <div
        className="relative w-full overflow-hidden rounded-[24px] border border-white/8 shadow-[0_24px_60px_rgba(0,0,0,0.45)] bg-[#0b1e36]"
        style={{ aspectRatio: "16 / 9" }}
      >
        <Image
          src={coverUrl}
          alt={story.title}
          fill
          unoptimized={unoptimizedCover}
          className="object-cover"
          sizes="(max-width: 720px) 100vw, 720px"
          priority
        />
        {/* Subtle bottom gradient so the title sits on a readable wash */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(11,30,58,0.85) 100%)",
          }}
        />
        {/* Title overlay sobre gradiente oscuro → blanco forzado en
            ambos temas vía inline style (bypasa el override de light
            mode que ennegrece text-white). */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <h1
            className="text-[26px] sm:text-[34px] font-black tracking-tight leading-tight"
            style={{ color: "#ffffff" }}
          >
            {story.title}
          </h1>
          <p className="mt-1 text-[13px] sm:text-[14px]" style={{ color: "rgba(255,255,255,0.78)" }}>
            From{" "}
            <span className="font-extrabold" style={{ color: "rgba(255,255,255,0.95)" }}>
              {book.title}
            </span>
          </p>
        </div>
      </div>

      {/* ── Meta chips ── */}
      <div className="mt-5 flex flex-wrap gap-2">
        {book.language ? (
          <span
            className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-extrabold"
            style={{
              background: "rgba(125, 211, 252, 0.12)",
              color: "#7dd3fc",
              border: "1px solid rgba(125, 211, 252, 0.3)",
            }}
          >
            {formatLanguage(book.language)}
          </span>
        ) : null}
        {book.level ? (
          <span
            className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-extrabold"
            style={{
              background: "rgba(252, 211, 77, 0.12)",
              color: "#fcd34d",
              border: "1px solid rgba(252, 211, 77, 0.3)",
            }}
          >
            {formatLevel(book.level)}
          </span>
        ) : null}
        {book.topic ? (
          <span
            className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-extrabold"
            style={{
              background: "rgba(190, 242, 100, 0.12)",
              color: "#bef264",
              border: "1px solid rgba(190, 242, 100, 0.3)",
            }}
          >
            {formatTopic(book.topic)}
          </span>
        ) : null}
        {story.focus ? (
          <span
            className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-extrabold"
            style={{
              background: "rgba(244, 114, 182, 0.12)",
              color: "#f9a8d4",
              border: "1px solid rgba(244, 114, 182, 0.3)",
            }}
          >
            {toTitleCase(story.focus)}
          </span>
        ) : null}
      </div>

      {/* ── Description (trimmed) ── */}
      <p className="mt-5 text-[15px] leading-7 text-[var(--foreground)]">
        {description}
      </p>

      {/* ── CTAs ── */}
      <div className="mt-7 flex flex-col sm:flex-row gap-3">
        <Link
          href={`/books/${book.slug}/${story.slug}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-gold)] px-6 py-3 text-[14px] font-extrabold text-[#2a1a02] hover:brightness-105 shadow-[0_10px_24px_rgba(252,211,77,0.22)]"
        >
          <Play size={15} fill="currentColor" />
          Read this week&apos;s story
        </Link>
        <Link
          href="/plans"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-6 py-3 text-[14px] font-bold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
        >
          <Crown size={15} className="text-[var(--color-gold)]" />
          Unlock all stories
        </Link>
      </div>

      <p className="mt-4 text-[12px] text-[var(--muted)]">
        Free this week. New story every Monday — upgrade for the daily pick.
      </p>
    </div>
  );
}
