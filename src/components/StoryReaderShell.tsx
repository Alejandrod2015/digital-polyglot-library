// /src/components/StoryReaderShell.tsx
//
// The reader's chrome, extracted from `src/app/stories/[slug]/page.tsx` so
// there is ONE of it.
//
// WHY this exists: Talking Points needed the same reader, and it was being
// rebuilt by hand; copying class names across, drifting on every detail, and
// guaranteed to drift again the next time the story page is touched. The
// container, the title block, the cover slot, the player dock and the vocab
// panel mount are identical for any reader we will ever have, so they live
// here and both routes call it.
//
// What stays OUT of the shell, on purpose, because it genuinely differs per
// route: the access gate, the body itself (prose, karaoke or tap-gloss), the
// end-of-story prompt, and whatever the dock contains. Those arrive as
// children and slots.

import * as React from "react";
import Image from "next/image";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";
import RegionBadge from "@/components/RegionBadge";
import ScrollToTopOnPathChange from "@/components/ScrollToTopOnPathChange";
import VocabPanel from "@/components/VocabPanel";
import type { TapGloss } from "@/lib/tapGlosses";

// Reuse the canonical shape rather than re-declaring a near-copy; VocabPanel
// is typed against this one and a structural near-miss fails to assign.
import type { VocabItem } from "@domain/types/books";

export type StoryReaderShellProps = {
  /** ReactNode, not string: the story page wraps its title in TapGlossText. */
  title: React.ReactNode;
  /** Rendered by LevelBadge; pass the CEFR code ("b2") or a friendly level. */
  level?: string;
  language?: string;
  region?: string;
  /** Optional chips appended after the three standard badges. */
  extraBadges?: React.ReactNode;
  /**
   * Cover image. Omit for readers that deliberately have none.
   * `blurUrl` feeds the desktop backdrop behind the contained image; without
   * it the backdrop falls back to `url`, which is what the story page does.
   */
  cover?: {
    url: string;
    blurUrl?: string | null;
    alt?: string;
    unoptimized?: boolean;
    unoptimizedBlur?: boolean;
    /**
     * Credit line under the image. Required by some licences (Wikimedia
     * Commons CC BY / CC BY-SA), so it renders with the photo rather than
     * being left to each caller to remember.
     */
    credit?: React.ReactNode;
  } | null;
  /** Anything between the header and the body (e.g. a save button). */
  headerSlot?: React.ReactNode;
  /** The body. Caller owns the gate, the prose renderer and the end prompt. */
  children: React.ReactNode;
  /** Bottom-docked content: the real Player, a notice, or nothing. */
  dock?: React.ReactNode;
  /** Mounts VocabPanel for the tap-a-word bubble when provided. */
  vocabPanel?: {
    id: string;
    slug: string;
    title: string;
    language?: string | null;
    source?: "polyglot" | "standalone";
    vocab?: VocabItem[];
    glosses?: Record<string, TapGloss>;
  } | null;
};

export default function StoryReaderShell({
  title,
  level,
  language,
  region,
  extraBadges,
  cover,
  headerSlot,
  children,
  dock,
  vocabPanel,
}: StoryReaderShellProps) {
  return (
    <div
      className="relative max-w-5xl mx-auto pt-1 px-8 text-foreground"
      // El padding inferior reserva el alto REAL del player fijo (que el
      // Player mide y publica en `--story-content-pb`) + un espacio de lectura,
      // para que la última línea nunca quede tapada. Fallback 8rem si no hay
      // player (historia sin audio) o antes de que el Player mida.
      style={{ paddingBottom: "var(--story-content-pb, 8rem)" }}
    >
      <ScrollToTopOnPathChange />

      {headerSlot}

      {/* Título */}
      <div className="relative mb-7 pt-2">
        <h1 className="text-4xl font-bold text-[var(--foreground)] text-center">
          {title}
        </h1>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <LevelBadge level={level} />
          <LanguageBadge language={language} />
          <RegionBadge region={region} />
          {extraBadges}
        </div>
      </div>

      {/* Cover de historia (solo si existe) */}
      {cover ? (
        <div className="mb-7">
          <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#102746] md:h-[220px] lg:h-[240px]">
            <div className="relative w-full md:hidden aspect-[16/10]">
              <Image
                src={cover.url}
                alt={cover.alt ?? ""}
                fill
                priority
                unoptimized={cover.unoptimized}
                sizes="(max-width: 768px) 100vw, 0px"
                className="object-contain"
              />
            </div>
            <div className="absolute inset-0 hidden md:block">
              <Image
                src={cover.blurUrl ?? cover.url}
                alt=""
                aria-hidden="true"
                fill
                priority
                unoptimized={cover.unoptimizedBlur ?? cover.unoptimized}
                sizes="(max-width: 1024px) 896px, 960px"
                className="object-cover scale-110 blur-2xl opacity-65"
              />
            </div>
            <div
              className="absolute inset-0 hidden md:block"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--bg-content) 16%, transparent) 0%, color-mix(in srgb, var(--bg-content) 54%, transparent) 100%)",
              }}
            />
            <div className="relative z-10 hidden h-full w-full md:block">
              <Image
                src={cover.url}
                alt={cover.alt ?? ""}
                fill
                priority
                unoptimized={cover.unoptimized}
                sizes="(max-width: 1024px) 896px, 960px"
                className="object-contain"
              />
            </div>
          </div>
          {cover.credit ? (
            <p className="mx-auto mt-2 max-w-3xl text-[11px] font-semibold text-[var(--muted)]">
              {cover.credit}
            </p>
          ) : null}
        </div>
      ) : null}

      {children}

      {dock}

      {vocabPanel ? <VocabPanel story={vocabPanel} /> : null}
    </div>
  );
}
