"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatLanguage, formatLevel } from "@/lib/displayFormat";

type BookSuggestion = {
  kind: "book";
  id: string;
  title: string;
  href: string;
  subtitle: string;
  coverUrl: string;
};

type BookStorySuggestion = {
  kind: "bookStory";
  id: string;
  title: string;
  href: string;
  subtitle: string;
  coverUrl: string;
};

type PolyglotStorySuggestion = {
  kind: "polyglotStory";
  id: string;
  title: string;
  href: string;
  subtitle: string;
  coverUrl: string;
};

type Suggestion = BookSuggestion | BookStorySuggestion | PolyglotStorySuggestion;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function getMaybeNumber(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function scoreMatch(haystack: string, tokens: string[]): number {
  // Simple scoring:
  // - each token must appear; earlier matches score more
  // - longer token matches score slightly higher
  let score = 0;

  for (const t of tokens) {
    const idx = haystack.indexOf(t);
    if (idx === -1) return 0;
    score += 50;
    score += Math.max(0, 30 - idx); // earlier is better
    score += Math.min(20, t.length * 2);
  }

  return score;
}

function summarize(text: string, maxLen: number): string {
  const clean = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen).trim()}…`;
}

type ExploreSearchProps = {
  books: unknown[];
  bookStories: Array<{
    id: string;
    bookSlug: string;
    bookTitle: string;
    storySlug: string;
    storyTitle: string;
    language: string;
    level: string;
    coverUrl: string;
  }>;
  polyglotStories: Array<{
    id: string;
    slug: string;
    title: string;
    language: string;
    level: string;
    topic?: string;
    text: string;
    coverUrl?: string;
  }>;
  className?: string;
  returnTo?: string;
  returnLabel?: string;
};

export default function ExploreSearch({
  books,
  bookStories,
  polyglotStories,
  className,
  returnTo,
  returnLabel,
}: ExploreSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const suggestions = useMemo((): Suggestion[] => {
    const q = normalize(query);
    if (q.length < 2) return [];

    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const maxItems = 10;
    const results: Array<{ s: Suggestion; score: number }> = [];

    const withReturnContext = (href: string): string => {
      if (!returnTo) return href;
      const [base, existingQuery = ""] = href.split("?");
      const params = new URLSearchParams(existingQuery);
      params.set("returnTo", returnTo);
      if (returnLabel) params.set("returnLabel", returnLabel);
      return `${base}?${params.toString()}`;
    };

    // Books (from unknown[])
    for (const b of books) {
      if (!isRecord(b)) continue;

      const slug = getString(b, "slug") ?? "";
      if (!slug) continue;

      const title = getString(b, "title") ?? slug;
      const language = getString(b, "language") ?? "";
      const level = getString(b, "level") ?? "";
      const coverRaw = getString(b, "cover");
      const coverUrl =
        typeof coverRaw === "string" && coverRaw.trim() !== ""
          ? coverRaw
          : "/covers/default.jpg";

      const hay = normalize([title, slug, language, level].filter(Boolean).join(" · "));
      const sc = scoreMatch(hay, tokens);
      if (sc <= 0) continue;

      results.push({
        s: {
          kind: "book",
          id: `book:${slug}`,
          title,
          href: withReturnContext(`/books/${slug}`),
          subtitle: [formatLanguage(language), formatLevel(level)].join(" · "),
          coverUrl,
        },
        score: sc,
      });
    }

    // Book stories
    for (const bs of bookStories) {
      const hay = normalize(
        [
          bs.storyTitle,
          bs.storySlug,
          bs.bookTitle,
          bs.bookSlug,
          bs.language,
          bs.level,
        ]
          .filter(Boolean)
          .join(" · ")
      );
      const sc = scoreMatch(hay, tokens);
      if (sc <= 0) continue;

      results.push({
        s: {
          kind: "bookStory",
          id: `bookStory:${bs.bookSlug}:${bs.storySlug}`,
          title: bs.storyTitle || "Untitled story",
          href: withReturnContext(`/books/${bs.bookSlug}/${bs.storySlug}`),
          subtitle: [
            bs.bookTitle || bs.bookSlug,
            formatLanguage(bs.language),
            formatLevel(bs.level),
          ]
            .filter(Boolean)
            .join(" · "),
          coverUrl: bs.coverUrl || "/covers/default.jpg",
        },
        score: sc + 10, // small boost for story results
      });
    }

    // Polyglot stories
    for (const ps of polyglotStories) {
      const coverUrl =
        typeof ps.coverUrl === "string" && ps.coverUrl.trim() !== ""
          ? ps.coverUrl
          : "/covers/default.jpg";

      const textPreview = summarize(ps.text ?? "", 90);
      const hay = normalize(
        [ps.title, ps.slug, ps.language, ps.level, ps.topic, textPreview]
          .filter(Boolean)
          .join(" · ")
      );
      const sc = scoreMatch(hay, tokens);
      if (sc <= 0) continue;

      results.push({
        s: {
          kind: "polyglotStory",
          id: `polyglot:${ps.slug}`,
          title: ps.title,
          href: withReturnContext(`/stories/${ps.slug}`),
          subtitle: [formatLanguage(ps.language), formatLevel(ps.level)].join(" · "),
          coverUrl,
        },
        score: sc,
      });
    }

    results.sort((a, b) => b.score - a.score);

    // de-dupe by id
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    for (const r of results) {
      if (seen.has(r.s.id)) continue;
      seen.add(r.s.id);
      out.push(r.s);
      if (out.length >= maxItems) break;
    }

    return out;
  }, [query, books, bookStories, polyglotStories, returnTo, returnLabel]);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (!root.contains(target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, []);

  useEffect(() => {
    if (!open) setActiveIndex(-1);
  }, [open]);

  useEffect(() => {
    if (query.trim().length >= 2 && suggestions.length > 0) {
      setOpen(true);
    } else {
      setOpen(false);
      setActiveIndex(-1);
    }
  }, [query, suggestions.length]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => clamp(prev + 1, 0, suggestions.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => clamp(prev - 1, 0, suggestions.length - 1));
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === "Enter") {
      if (activeIndex < 0 || activeIndex >= suggestions.length) return;
      const s = suggestions[activeIndex];
      router.push(s.href);
    }
  };

  const hint = useMemo(() => {
    const q = normalize(query);
    if (q.length < 2) return "Search stories or books (e.g. Colombia, spanish)";
    if (suggestions.length === 0) return "No matches";
    return `${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"}`;
  }, [query, suggestions.length]);

  return (
    <div ref={rootRef} className={className}>
      <div className="relative">
        <div className="flex items-center gap-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--card-border)] px-4 py-3 shadow-sm focus-within:border-[var(--chip-border)] focus-within:bg-[var(--card-bg-hover)]">
          <span aria-hidden="true" className="text-[var(--muted)]">
            {/* magnifier */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M16.5 16.5 21 21"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              if (query.trim().length >= 2 && suggestions.length > 0) setOpen(true);
            }}
            placeholder="Search"
            className="w-full bg-transparent outline-none text-[var(--foreground)] placeholder:text-[var(--muted)]"
            autoComplete="off"
            spellCheck={false}
          />

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] px-2 py-1 rounded-lg hover:bg-[var(--card-bg-hover)]"
            aria-label="Clear search"
          >
            Clear
          </button>
        </div>

        <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p>

        {open ? (
          <div className="absolute z-50 mt-3 w-full overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--nav-bg)] backdrop-blur shadow-2xl">
            <div className="max-h-[420px] overflow-auto">
              {suggestions.map((s, idx) => {
                const isActive = idx === activeIndex;
                const badge =
                  s.kind === "book"
                    ? "Book"
                    : s.kind === "bookStory"
                    ? "Story"
                    : "Story";

                return (
                  <Link
                    key={s.id}
                    href={s.href}
                    className={[
                      "flex items-center gap-4 px-4 py-3 transition-colors",
                      isActive ? "bg-[var(--card-bg-hover)]" : "hover:bg-[var(--card-bg)]",
                    ].join(" ")}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => {
                      setOpen(false);
                      setActiveIndex(-1);
                    }}
                  >
                    <div className="h-12 w-12 rounded-xl overflow-hidden bg-[var(--card-bg)] flex-none">
                      <img
                        src={s.coverUrl}
                        alt={s.title}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--foreground)] truncate">{s.title}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--chip-bg)] text-[var(--chip-text)] border border-[var(--chip-border)] flex-none">
                          {badge}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted)] truncate">{s.subtitle}</p>
                    </div>

                    <span aria-hidden="true" className="text-[var(--muted)]">
                      {/* arrow */}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M9 18 15 12 9 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-[var(--card-border)] text-xs text-[var(--muted)]">
              Tip: use ↑ ↓ and Enter
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
