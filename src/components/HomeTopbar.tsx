"use client";

import { Search, Bell } from "lucide-react";
import { useUser } from "@clerk/nextjs";

type Props = {
  /** Used to switch the greeting line: "Pick up where you left off" vs "Start a new story" */
  continueCount: number;
};

/**
 * Top bar above the Home content.
 * Greeting (left) · search (center, flex-1) · notifications bell (right).
 *
 * Drop straight into HomeClient.tsx as the very first child of <main>.
 */
export default function HomeTopbar({ continueCount }: Props) {
  const { user } = useUser();
  const firstName = user?.firstName ?? "";

  const hour = new Date().getHours();
  const greetWord =
    hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  const title =
    continueCount > 0 ? "Pick up where you left off" : "Start a new story";

  return (
    <header className="flex items-center gap-4 mb-8">
      <div className="flex flex-col">
        <span className="text-[13px] font-bold text-[var(--muted)]">
          {greetWord}
          {firstName ? `, ${firstName}` : ""}
        </span>
        <h1 className="text-[26px] font-black tracking-[-0.02em] leading-tight mt-0.5 text-[var(--foreground)]">
          {title}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2.5 px-4 py-2.5 w-[320px] max-w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-full text-[var(--muted)] focus-within:border-[var(--color-gold)] transition-colors">
          <Search size={16} />
          <input
            placeholder="Search stories, books, or topics"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[var(--foreground)] text-sm font-bold placeholder:text-[var(--muted)] placeholder:font-bold"
          />
          <kbd className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-[var(--card-border)]">
            ⌘K
          </kbd>
        </div>
        <button
          aria-label="Notifications"
          className="w-10 h-10 grid place-items-center rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--card-bg-hover)] relative shrink-0 transition-colors"
        >
          <Bell size={18} />
          <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[#fb923c] border-2 border-[var(--bg-content)]" />
        </button>
      </div>
    </header>
  );
}
