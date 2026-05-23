"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";

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
  ctaHref?: string | null;
  ctaLabel?: string;
  ctaDisabledLabel?: string | null;
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
  ctaHref,
  ctaLabel = "Open topic",
  ctaDisabledLabel,
}: TopicPreviewSheetProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="topic-preview-title"
    >
      {/* Backdrop transparente (sin fondo opaco). Captura el click
          fuera del sheet para cerrar, pero NO ennegrece la página. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0"
        style={{ animation: "fade-in 180ms ease-out both" }}
      />
      <div
        className="relative w-full max-w-[480px] rounded-t-[1.6rem] border p-5 shadow-2xl sm:rounded-[1.6rem]"
        style={{
          // Gradient con tokens: dark = navy (--bg-2/--bg-1); light =
          // cream (--bg-2 e8e2d2 / --bg-1 efe9da). Consistente con el
          // resto de sheets de la app.
          background:
            "linear-gradient(180deg, var(--bg-2) 0%, var(--bg-1, var(--background)) 100%)",
          borderColor: "var(--card-border)",
          color: "var(--foreground)",
          animation: "sheet-pop 320ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--card-border)",
            color: "var(--muted)",
          }}
        >
          <X size={16} />
        </button>
        {coverUrl ? (
          <div
            className="relative h-32 w-full overflow-hidden rounded-[1.1rem] border"
            style={{ borderColor: "var(--card-border)" }}
          >
            <Image src={coverUrl} alt={label} fill className="object-cover" sizes="480px" />
          </div>
        ) : null}
        {eyebrow ? (
          <p
            className="mt-4 text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--color-gold)" }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2
          id="topic-preview-title"
          className="mt-1 text-[1.6rem] font-black tracking-tight"
          style={{ color: "var(--foreground)" }}
        >
          {label}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {storyCount} {storyCount === 1 ? "story" : "stories"}
        </p>
        {description ? (
          <p
            className="mt-3 text-sm leading-6"
            style={{ color: "var(--foreground)" }}
          >
            {description}
          </p>
        ) : null}
        {stories && stories.length > 0 ? (
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
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-sm font-extrabold tracking-wide hover:brightness-105"
            style={{ background: "var(--color-gold)", color: "#2a1a02" }}
          >
            {ctaLabel}
          </Link>
        ) : (
          <div
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl border px-4 py-3.5 text-sm font-semibold"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--card-border)",
              color: "var(--muted)",
            }}
          >
            {ctaDisabledLabel ?? "Locked"}
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sheet-pop {
          0% { opacity: 0; transform: translateY(40px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
