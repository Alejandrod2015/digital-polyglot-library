"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import LevelBadge from "@/components/LevelBadge";

type StoryVerticalCardProps = {
  href: string;
  title: string;
  coverUrl?: string;
  subtitle?: string;
  excerpt?: string;
  meta?: string;
  metaSecondary?: string;
  level?: string;
  className?: string;
  footer?: ReactNode;
};

export default function StoryVerticalCard({
  href,
  title,
  coverUrl,
  subtitle,
  excerpt,
  meta,
  metaSecondary,
  level,
  className = "",
  footer,
}: StoryVerticalCardProps) {
  return (
    <div
      className={`flex flex-col h-full rounded-2xl overflow-hidden bg-white/5 hover:bg-white/10 transition-all duration-200 shadow-md ${className}`}
    >
      <Link
        href={href}
        className="flex flex-col h-full"
      >
        <div className="w-full h-48 bg-gray-800">
          <img
            src={coverUrl || "/covers/default.jpg"}
            alt={title}
            className="object-cover w-full h-full"
          />
        </div>

        <div className="p-5 flex flex-col justify-between flex-1 text-left">
          <div>
            <div className="mb-2">
              <LevelBadge level={level} />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white line-clamp-2">{title}</h3>
            {subtitle ? (
              <p className="text-sky-300 text-sm leading-relaxed line-clamp-1">{subtitle}</p>
            ) : null}
            {excerpt ? <p className="mt-2 text-sm text-gray-300 line-clamp-3">{excerpt}</p> : null}
          </div>

          {(meta || metaSecondary) && (
            <div className="mt-3 text-sm text-gray-400 space-y-1">
              {meta ? <p>{meta}</p> : null}
              {metaSecondary ? <p>{metaSecondary}</p> : null}
            </div>
          )}
        </div>
      </Link>

      {footer ? <div className="border-t border-white/10 px-3 py-2">{footer}</div> : null}
    </div>
  );
}
