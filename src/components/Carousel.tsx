'use client';

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { EmblaOptionsType } from 'embla-carousel';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils';

type CarouselProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  options?: EmblaOptionsType;
};

/**
 * Carrusel híbrido real:
 * - Mobile (<768px): scroll nativo con momentum (sin JS, sin flechas)
 * - Desktop (≥768px): Embla con flechas y 3 visibles
 */
export default function Carousel<T>({
  items,
  renderItem,
  className,
  options,
}: CarouselProps<T>) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: 'start',
    slidesToScroll: 1,
    ...options,
  });

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Detectar viewport una sola vez (sin SSR flicker)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mql.matches);
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, []);

  const updateButtons = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || !isDesktop) return;
    updateButtons();
    emblaApi.on('select', updateButtons);
    emblaApi.on('reInit', updateButtons);
    return () => {
      emblaApi.off('select', updateButtons);
      emblaApi.off('reInit', updateButtons);
    };
  }, [emblaApi, isDesktop, updateButtons]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // 🔹 MOBILE → scroll nativo (permite vertical + horizontal)
  if (!isDesktop) {
    return (
      <div className={cn('relative w-full flex flex-col gap-3', className)}>
        <div
          className="hide-scrollbar flex gap-4 overflow-x-auto snap-x snap-mandatory px-1 scroll-smooth"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="snap-start flex-shrink-0 w-[70%] sm:w-[55%]"
            >
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 🔹 DESKTOP → carrusel Embla
  return (
    <div className={cn('relative w-full flex items-center gap-3', className)}>
      {/* Flecha izquierda */}
      <button
        type="button"
        onClick={scrollPrev}
        disabled={!canScrollPrev}
        className={cn(
          'hidden md:flex flex-shrink-0 p-2 bg-[#1B2347] rounded-full shadow-lg transition-opacity',
          canScrollPrev ? 'opacity-100' : 'opacity-40 cursor-default'
        )}
      >
        <ChevronLeft className="w-5 h-5 text-white" />
      </button>

      <div className="overflow-hidden w-full" ref={emblaRef}>
        <div className="flex gap-6 will-change-transform">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex-shrink-0 snap-start w-[31%] transition-none"
            >
              {renderItem(item, i)}
            </div>
          ))}
        </div>
      </div>

      {/* Flecha derecha */}
      <button
        type="button"
        onClick={scrollNext}
        disabled={!canScrollNext}
        className={cn(
          'hidden md:flex flex-shrink-0 p-2 bg-[#1B2347] rounded-full shadow-lg transition-opacity',
          canScrollNext ? 'opacity-100' : 'opacity-40 cursor-default'
        )}
      >
        <ChevronRight className="w-5 h-5 text-white" />
      </button>
    </div>
  );
}
