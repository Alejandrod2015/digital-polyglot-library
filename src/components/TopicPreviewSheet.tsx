"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import BottomSheet from "@/components/ui/BottomSheet";

type TopicStoryPreview = {
  slug: string;
  title: string;
  coverUrl?: string | null;
};

export type TopicPreviewSheetProps = {
  open: boolean;
  onClose: () => void;
  label: string;
  eyebrow?: string | null;
  description?: string | null;
  coverUrl?: string | null;
  storyCount: number;
  stories?: TopicStoryPreview[];
  /** Story slugs in this topic. When provided, the sheet fetches the
   *  combined vocab list across all stories and renders it as a chip
   *  row (iPhone parity; that's the panel's content there). */
  storySlugs?: string[];
  ctaHref?: string | null;
  ctaLabel?: string;
  ctaDisabledLabel?: string | null;
};

type VocabFetchState = {
  words: string[];
  loading: boolean;
};

export function TopicPreviewSheet({
  open,
  onClose,
  label,
  eyebrow,
  description,
  coverUrl,
  storyCount,
  stories,
  storySlugs,
  ctaHref,
  ctaLabel = "Open topic",
  ctaDisabledLabel,
}: TopicPreviewSheetProps) {
  // Fetch vocab across all stories in the topic when the sheet opens.
  // /api/standalone-stories?slugs=a,b,c returns vocabRaw per story; we
  // dedupe by lowercased word and show up to ~24 chips. iPhone uses
  // the same endpoint at MobileLibraryShell.tsx:15064.
  const [vocab, setVocab] = useState<VocabFetchState>({ words: [], loading: false });
  useEffect(() => {
    if (!open || !storySlugs || storySlugs.length === 0) {
      setVocab({ words: [], loading: false });
      return;
    }
    let cancelled = false;
    setVocab({ words: [], loading: true });
    const url = `/api/standalone-stories?slugs=${encodeURIComponent(storySlugs.join(","))}`;
    fetch(url, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as {
          stories?: Array<{ vocabRaw?: string | null; vocab?: unknown }>;
        };
        const seen = new Set<string>();
        const words: string[] = [];
        for (const s of data.stories ?? []) {
          // Try parsed vocab first (already an array), then vocabRaw
          // (JSON string). Both shapes appear across catalog sources.
          let items: Array<{ word?: unknown }> = [];
          if (Array.isArray(s.vocab)) items = s.vocab as Array<{ word?: unknown }>;
          else if (typeof s.vocabRaw === "string") {
            try {
              const parsed = JSON.parse(s.vocabRaw);
              if (Array.isArray(parsed)) items = parsed as Array<{ word?: unknown }>;
            } catch {
              // skip malformed
            }
          }
          for (const it of items) {
            const w = typeof it.word === "string" ? it.word.trim() : "";
            if (!w) continue;
            const key = w.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            words.push(w);
          }
        }
        if (!cancelled) setVocab({ words, loading: false });
      })
      .catch(() => {
        if (!cancelled) setVocab({ words: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [open, storySlugs]);

  // Bottom-sheet panel (iPhone parity). The chrome (drag handle, swipe
  // to dismiss, safe-area-aware padding, backdrop click, escape key) is
  // owned by <BottomSheet/>; this component only owns the content
  // (cover, eyebrow, title, story count, description, vocab chips, CTA).
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={label}
      eyebrow={eyebrow ?? undefined}
      ariaLabel={label}
    >
      {coverUrl ? (
        <div
          className="relative aspect-[16/9] w-full overflow-hidden rounded-[1.1rem] border"
          style={{ borderColor: "var(--card-border)" }}
        >
          <Image
            src={coverUrl}
            alt={label}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 480px) 100vw, 480px"
          />
        </div>
      ) : null}
      <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
        {storyCount} {storyCount === 1 ? "story" : "stories"}
      </p>
      {description ? (
        <p
          className="mt-2 text-sm leading-6"
          style={{ color: "var(--foreground)" }}
        >
          {description}
        </p>
      ) : null}
      {/* iPhone parity: show vocabulary words from the topic as chips.
          Falls back to story titles when no slugs were passed (still
          useful in places where vocab fetching isn't wired). */}
      {storySlugs && storySlugs.length > 0 ? (
        <div className="mt-4">
          <p
            className="mb-2 text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--muted)" }}
          >
            Words you&apos;ll learn
          </p>
          {vocab.loading ? (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Loading words…
            </p>
          ) : vocab.words.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              No words yet for this topic.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {vocab.words.slice(0, 24).map((w) => (
                <span
                  key={w}
                  className="rounded-full border px-2.5 py-1 text-[12px] font-semibold"
                  style={{
                    background: "var(--card-bg)",
                    borderColor: "var(--card-border)",
                    color: "var(--foreground)",
                  }}
                >
                  {w}
                </span>
              ))}
              {vocab.words.length > 24 ? (
                <span
                  className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                  style={{ color: "var(--muted)" }}
                >
                  +{vocab.words.length - 24}
                </span>
              ) : null}
            </div>
          )}
        </div>
      ) : stories && stories.length > 0 ? (
        <div className="mt-4">
          <p
            className="mb-2 text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--muted)" }}
          >
            In this topic
          </p>
          <ul className="space-y-1.5">
            {stories.slice(0, 4).map((story) => (
              <li
                key={story.slug}
                className="truncate rounded-lg border px-3 py-2 text-sm"
                style={{
                  background: "var(--card-bg)",
                  borderColor: "var(--card-border)",
                  color: "var(--foreground)",
                }}
              >
                {story.title}
              </li>
            ))}
            {stories.length > 4 ? (
              <li
                className="px-3 text-xs"
                style={{ color: "var(--muted)" }}
              >
                +{stories.length - 4} more
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      {ctaHref ? (
        <Link
          href={ctaHref}
          onClick={onClose}
          className="mt-5 mb-2 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-sm font-extrabold tracking-wide hover:brightness-105"
          style={{ background: "var(--color-gold)", color: "var(--color-gold-ink)" }}
        >
          {ctaLabel}
        </Link>
      ) : (
        <div
          className="mt-5 mb-2 inline-flex w-full items-center justify-center rounded-2xl border px-4 py-3.5 text-sm font-semibold"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--card-border)",
            color: "var(--muted)",
          }}
        >
          {ctaDisabledLabel ?? "Locked"}
        </div>
      )}
    </BottomSheet>
  );
}
