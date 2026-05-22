"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [q, setQ] = useState("");

  // Cmd/Ctrl + K focusa el search. Sin badge visible — el atajo
  // funciona pero no le explicamos al user que existe.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key === "k" || e.key === "K";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const submitSearch = () => {
    const trimmed = q.trim();
    if (!trimmed) {
      router.push("/explore");
      return;
    }
    router.push(`/explore?q=${encodeURIComponent(trimmed)}`);
  };

  // Saludo removido: "Good afternoon" cada visita pesaba más de lo
  // que aportaba. El título principal carga el propósito de la
  // sección sin necesitar wrapper de cortesía.
  const title =
    continueCount > 0 ? "Pick up where you left off" : "Start a new story";

  return (
    <header className="flex items-center gap-4 mb-8">
      {/* Title column: takes all available space and is allowed to shrink
          so it never gets squeezed into one-word-per-line by the search
          input next to it on narrow viewports. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="text-[22px] sm:text-[26px] font-black tracking-[-0.02em] leading-tight text-[var(--foreground)]">
          {title}
        </h1>
      </div>

      {/* Right-side actions. Mobile sees nothing here (search lives on
          /explore, matching the iPhone app). Desktop shows the search
          pill from md+. The notifications bell was removed: nothing was
          wired to it yet, so it added noise without a payoff. */}
      <div className="hidden md:flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-2.5 px-4 py-2.5 w-[320px] max-w-full bg-[var(--card-bg)] border border-[var(--card-border)] rounded-full text-[var(--muted)] focus-within:border-[var(--color-gold)] transition-colors">
          <Search size={16} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitSearch();
              }
              if (e.key === "Escape") {
                e.currentTarget.blur();
              }
            }}
            placeholder="Search stories, books, or topics"
            aria-label="Search"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-[var(--foreground)] text-sm font-bold placeholder:text-[var(--muted)] placeholder:font-bold"
          />
        </div>
      </div>
    </header>
  );
}
