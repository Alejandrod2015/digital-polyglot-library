"use client";

import Link from "next/link";
import Cover from "@/components/Cover";
import type { ReactNode } from "react";

function stripHtml(input?: string): string {
  return (input ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function excerpt(text?: string, max = 132): string {
  const clean = stripHtml(text);
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}...`;
}

type BookHorizontalCardProps = {
  title: string;
  cover?: string;
  meta?: string;
  description?: string;
  href: string;
  footer?: ReactNode;
};

export default function BookHorizontalCard({
  title,
  cover,
  meta,
  description,
  href,
  footer,
}: BookHorizontalCardProps) {
  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden bg-white/5 hover:bg-white/10 hover:shadow-md transition-all duration-200">
      <Link
        href={href}
        className="flex items-center gap-5 w-full p-5 h-full min-h-[220px] md:min-h-[230px]"
      >
        <div className="w-[34%] max-w-[122px] flex-shrink-0">
          <Cover src={cover ?? "/covers/default.jpg"} alt={title} />
        </div>

        <div className="flex flex-col justify-center text-left flex-1 text-white">
          <p className="font-semibold text-lg leading-snug mb-2 line-clamp-2">{title}</p>
          {meta ? <p className="text-sm text-white/80">{meta}</p> : null}
          {description ? (
            <p className="text-sm text-white/60 mt-2 line-clamp-3">{excerpt(description, 132)}</p>
          ) : null}
        </div>
      </Link>

      {footer ? <div className="border-t border-white/10 px-3 py-2">{footer}</div> : null}
    </div>
  );
}
