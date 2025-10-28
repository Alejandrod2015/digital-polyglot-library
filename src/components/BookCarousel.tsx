// /src/components/BookCarousel.tsx
// ANTES → DESPUÉS

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaOptionsType } from "embla-carousel";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils";
import Cover from "@/components/Cover";

type Book = {
  slug: string;
  title: string;
  language?: string;
  level?: string;
  cover?: string;
};

type BookCarouselProps = {
  items?: Book[];
  className?: string;
  options?: EmblaOptionsType;
};

export default function BookCarousel({
  items = [],
  className,
  options,
}: BookCarouselProps) {

  // ✅ Un único carrusel (Embla) para todos los breakpoints
  //    → sin ramas condicionales móvil/desktop, sin parpadeos.
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
      {/* Flecha izquierda (solo desktop) */}
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

      {/* Viewport Embla */}
      <div className="overflow-hidden w-full" ref={emblaRef}>
        <div className="flex gap-4 will-change-transform px-1">
          {items.map((book) => (
            <div
              key={book.slug}
              // 🔹 Móvil: 2 por pantalla → 45%
              // 🔹 Desktop: ~3 por pantalla → 31%
              className="flex-[0_0_45%] md:flex-[0_0_31%] snap-start"
            >
              <Link
                href={`/books/${book.slug}?from=explore`}
                className="block bg-white/5 hover:bg-white/10 rounded-2xl p-3 md:p-4 transition-all"
              >
                {/* Mantener 2:3 sin que crezca a ancho completo del viewport */}
                <div className="aspect-[2/3] rounded-2xl overflow-hidden">
                  <Cover src={book.cover} alt={book.title} className="w-full" />
                </div>
                <div className="mt-2 md:mt-3 text-left">
                  <p className="text-sm md:text-base font-semibold text-white line-clamp-2">
                    {book.title}
                  </p>
                  <p className="text-xs md:text-sm text-gray-400">
                    {book.language} · {book.level}
                  </p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Flecha derecha (solo desktop) */}
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
