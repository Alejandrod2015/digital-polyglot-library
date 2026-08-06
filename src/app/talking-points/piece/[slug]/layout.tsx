// /src/app/talking-points/piece/[slug]/layout.tsx
//
// Mirrors `src/app/stories/[slug]/layout.tsx`: the back affordance is a
// FLOATING circular button in the top-left, fixed so it survives scrolling,
// and it lives in the layout rather than the page so the story owns the full
// viewport with no inline top bar.

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TalkingPointPieceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col min-h-full text-foreground">
      <Link
        href="/talking-points"
        aria-label="Back to Talking Points"
        className="fixed left-3 top-3 z-50 inline-grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-[#081a31] text-white backdrop-blur-md no-underline md:left-6 md:top-6"
      >
        <ArrowLeft size={20} aria-hidden />
      </Link>

      <main className="flex-1">{children}</main>
    </div>
  );
}
