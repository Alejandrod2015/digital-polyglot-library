"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaOptionsType } from "embla-carousel";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils";

type Props<T> = {
  items: T[];
  className?: string;
  itemClassName?: string;
  options?: EmblaOptionsType;
  renderItem: (item: T) => React.ReactNode;
};

export default function ReleaseCarousel<T>({
  items,
  className,
  itemClassName,
  options,
  renderItem,
}: Props<T>) {
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
      emblaApi.off("select", updateButtons);
      emblaApi.off("reInit", updateButtons);
    };
  }, [emblaApi, updateButtons]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <div className={cn("relative w-full flex items-center gap-3", className)}>
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

      <div className="overflow-hidden w-full" ref={emblaRef}>
        <div className="flex gap-6 will-change-transform px-0">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={cn(
                "flex-[0_0_45%] sm:flex-[0_0_30%] md:flex-[0_0_23%] lg:flex-[0_0_22%] xl:flex-[0_0_20%] snap-start",
                itemClassName
              )}
            >
              {renderItem(item)}
            </div>
          ))}
        </div>
      </div>

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
