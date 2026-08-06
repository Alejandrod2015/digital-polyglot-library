"use client";

// THE READER. It no longer rebuilds anything: the chrome comes from
// `StoryReaderShell`, the same component `src/app/stories/[slug]/page.tsx`
// uses, and the prose comes from `StoryContent`, the same component the
// stories use. This file only supplies the data and the two things that are
// genuinely specific to non-fiction: the sources panel, and a dock that says
// plainly there is no audio yet.
//
// Earlier versions hand-copied the reader's class names screen by screen. That
// never matched and would have drifted the next time the story page changed.

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import Player from "@/components/Player";
import StoryContent from "@/components/StoryContent";
import StoryReaderShell from "@/components/StoryReaderShell";
import type { TalkingPiece, TalkingTopic } from "@/lib/talkingPoints";
import { photoCredit } from "@/lib/wikimediaCommons";
import { markRead } from "@/lib/talkingPointsRun";

// Function declaration rather than a module-scope const: hoisted, so it can
// never land in a temporal-dead-zone if the bundler reorders the module.
function angleLabel(angle: string): string {
  if (angle === "explainer") return "Explainer";
  if (angle === "debate") return "Both sides";
  if (angle === "portrait") return "Portrait";
  return angle;
}

export default function PieceClient({
  topic,
  piece,
}: {
  topic: TalkingTopic;
  piece: TalkingPiece;
}) {
  const written = piece.body.length > 0;
  const endRef = useRef<HTMLDivElement | null>(null);
  const [showSources, setShowSources] = useState(true);

  // StoryContent takes one string and does its own paragraph chunking.
  const text = useMemo(() => piece.body.join("\n\n"), [piece.body]);

  // `surface` is required whenever the form in the prose differs from the
  // dictionary form, or the highlight silently fails to match.
  const vocab = useMemo(
    () =>
      piece.vocab.map((v) => ({
        word: v.term,
        surface: v.surface,
        type: v.type,
        definition: v.en,
      })),
    [piece.vocab]
  );

  // Stands in for JourneyStoryReadTracker: reaching the end marks it read.
  useEffect(() => {
    const el = endRef.current;
    if (!el || !written) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          markRead(piece.slug);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -20% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [piece.slug, written]);

  return (
    <StoryReaderShell
      title={piece.title}
      level={topic.level}
      language={topic.language}
      region={topic.country === "ES" ? "Spain" : topic.country}
      extraBadges={
        <span className="inline-flex h-5 items-center rounded-full border border-[var(--chip-border)] bg-[var(--chip-bg)] px-2 text-[11px] font-semibold leading-none text-[var(--chip-text)]">
          {angleLabel(piece.angle)}
        </span>
      }
      // A real photograph, credited. Stories carry an illustrated cover; this
      // section carries something that happened, which is the point of it.
      cover={
        piece.photo
          ? {
              url: piece.photo.url,
              alt: piece.photo.alt,
              // Commons files are already optimised and sit off-domain; let
              // them through untouched rather than re-encoding on our side.
              unoptimized: true,
              credit: (
                <>
                  Foto:{" "}
                  <a
                    href={piece.photo.filePage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-[var(--foreground)]"
                  >
                    {photoCredit(piece.photo)}
                  </a>
                </>
              ),
            }
          : null
      }
      vocabPanel={
        written
          ? {
              id: piece.slug,
              slug: piece.slug,
              title: piece.title,
              language: topic.language,
              vocab,
            }
          : null
      }
      dock={
        piece.audioUrl ? (
          // El Player real, montado igual que en /stories/[slug]: mismo id de
          // dock (publica --story-content-pb, que reserva el alto del player
          // para que la ultima linea no quede tapada) y mismo z-index.
          <div
            id="story-player-dock"
            className="fixed bottom-0 left-0 right-0 z-50 bg-transparent"
          >
            <Player
              src={piece.audioUrl}
              bookSlug="talking-points"
              storySlug={piece.slug}
              canPlay
            />
          </div>
        ) : (
          <PendingAudioDock />
        )
      }
    >
      {written ? (
        <div className="max-w-[65ch] mx-auto text-xl leading-relaxed text-[var(--foreground)] space-y-6">
          <StoryContent text={text} sentencesPerParagraph={3} vocab={vocab} />
          <SourcesPanel
            sources={piece.sources}
            open={showSources}
            onToggle={() => setShowSources((v) => !v)}
          />
          <div ref={endRef} />
          {/* SIN aviso de practica, a proposito.
              EndOfStoryPracticePrompt construye por defecto
              `/practice?source=story&storySlug=<slug>` y un enlace de vuelta a
              `/stories/<slug>`. Ninguna de las dos existe para una pieza de
              Talking Points: la ruta de historia da 404 y la practica no tiene
              ejercicios para este slug. Un boton que lleva a ninguna parte es
              peor que ningun boton. Vuelve cuando la seccion tenga ejercicios,
              pasandole un practiceHref propio. */}
        </div>
      ) : (
        <div className="max-w-[65ch] mx-auto rounded-2xl border border-dashed border-white/10 p-6 text-center">
          <h2 className="text-[16px] font-black text-[var(--foreground)] m-0">
            Not written yet
          </h2>
          <p className="mt-2 mb-0 text-[13px] font-semibold text-[var(--muted)]">
            The question is accepted and the topic is in the catalogue, but the
            prose and its sources are still pending. Nothing is generated here
            without a source behind every claim.
          </p>
        </div>
      )}
    </StoryReaderShell>
  );
}

/** The one block a fiction reader never needs. Open by default. */
function SourcesPanel({
  sources,
  open,
  onToggle,
}: {
  sources: TalkingPiece["sources"];
  open: boolean;
  onToggle: () => void;
}) {
  if (sources.length === 0) return null;

  // Compact on purpose. The earlier version printed the institution, the
  // linked title, a summary of what the source supports, and the date it was
  // checked — four lines each, so three sources weighed as much as the piece
  // itself, at the exact moment the reader has finished and cares least.
  //
  // `supports`, `checkedAt` and `needsVerification` stay in the data: they are
  // what the Studio needs to review a piece before it publishes. They are not
  // what a reader needs after it has.
  return (
    <section className="pt-5 border-t border-white/[0.08]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        Sources ({sources.length})
      </button>
      {open && (
        <ol className="list-none p-0 mt-2.5 mb-0 flex flex-col gap-1.5">
          {sources.map((source) => (
            <li key={source.id} className="text-[13px] leading-snug">
              <span className="font-extrabold text-[var(--muted)]">
                {source.org}
              </span>
              <span className="text-[var(--muted)]"> &middot; </span>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[var(--color-gold)] no-underline hover:underline"
              >
                {source.title}
                <ExternalLink
                  size={11}
                  className="ml-1 inline-block align-baseline"
                  aria-hidden
                />
              </a>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Shown only while a piece has no rendered narration. It holds the same slot at
 * roughly the player's height so the layout does not jump when audio lands, and
 * it says plainly that there is nothing to play rather than faking controls.
 */
function PendingAudioDock() {
  return (
    <div
      id="story-player-dock"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[rgba(7,16,30,0.94)] backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-3xl px-5 py-5 text-center">
        <p className="m-0 text-[12px] font-bold text-[var(--muted)]">
          Esta pieza todavia no tiene narracion.
        </p>
      </div>
    </div>
  );
}
