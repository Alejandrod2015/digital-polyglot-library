"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaOptionsType } from "embla-carousel";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils";
import Cover from "@/components/Cover";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";

type Book = {
  slug: string;
  title: string;
  language?: string;
  level?: string;
  cover?: string;
  description?: string;
  bookId: string; // Necesario para eliminar
};

type BookCarouselProps = {
  items?: Book[];
  className?: string;
  options?: EmblaOptionsType;
  renderActions?: (book: Book) => React.ReactNode;
  hrefForBook?: (book: Book) => string;
};

function stripHtml(input?: string): string {
  return (input ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function excerpt(text?: string, max = 132): string {
  const clean = stripHtml(text);
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}...`;
}

export default function BookCarousel({
  items = [],
  className,
  options,
  renderActions,
  hrefForBook,
}: BookCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    slidesToScroll: 1,
    ...options,
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const updateButtons = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    updateButtons();
    emblaApi.on("select", updateButtons);
    emblaApi.on("reInit", updateButtons);
    return () => {
      emblaApi?.off("select", updateButtons);
      emblaApi?.off("reInit", updateButtons);
    };
  }, [emblaApi, updateButtons]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <div className={cn("relative w-full flex items-center gap-3", className)}>
      {/* Flecha izquierda */}
      <button
        type="button"
        onClick={scrollPrev}
        aria-label="Previous"
        disabled={!canScrollPrev}
        className={cn(
          "hidden md:flex flex-shrink-0 p-2 bg-[#1B2347] rounded-full shadow-lg transition-opacity",
          canScrollPrev ? "opacity-100" : "opacity-40 cursor-default"
        )}
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>

      {/* Embla Viewport */}
      <div className="overflow-hidden w-full" ref={emblaRef}>
        <div className="flex gap-6 will-change-transform px-0">

          {items.map((book) => (
            <div
              key={book.slug}
              className="flex-[0_0_45%] sm:flex-[0_0_30%] md:flex-[0_0_23%] lg:flex-[0_0_22%] xl:flex-[0_0_20%] snap-start"
            >
              <div className="bg-white/5 hover:bg-white/10 rounded-2xl overflow-hidden shadow-md transition-all flex flex-col h-full">

                {/* Enlace + portada */}
                <Link
                  href={hrefForBook ? hrefForBook(book) : `/books/${book.slug}?from=my-library`}
                  className="flex items-center gap-5 p-5 flex-1 min-h-[220px] md:min-h-[230px]"
                >
                  <div className="w-[34%] max-w-[122px] flex-shrink-0">
                    <Cover src={book.cover} alt={book.title} />
                  </div>

                  <div className="text-left flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <LevelBadge level={book.level} />
                      <LanguageBadge language={book.language} />
                    </div>
                    <p className="text-base font-semibold text-white line-clamp-2">
                      {book.title}
                    </p>
                    {book.description ? (
                      <p className="text-sm text-white/60 mt-2 line-clamp-3">
                        {excerpt(book.description, 132)}
                      </p>
                    ) : null}
                  </div>
                </Link>

                {/* Botón Remove abajo con borde superior */}
                {renderActions && (
                  <div className="border-t border-white/10 p-3">
                    {renderActions(book)}
                  </div>
                )}
              </div>
            </div>
          ))}

        </div>
      </div>

      {/* Flecha derecha */}
      <button
        type="button"
        onClick={scrollNext}
        aria-label="Next"
        disabled={!canScrollNext}
        className={cn(
          "hidden md:flex flex-shrink-0 p-2 bg-[#1B2347] rounded-full shadow-lg transition-opacity",
          canScrollNext ? "opacity-100" : "opacity-40 cursor-default"
        )}
      >
        <ChevronRight className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}
