"use client";

// Client-side toolbar (chip filters + free-text search + sort) for the
// blog index. The server passes the full post list; this component renders
// the filtered subset with pagination.
//
// Toolbar layout:
//   row 1: dialect chips + search + RSS
//   row 2: post-type chips (Phrases / Grammar / Vocab / Guide / Essay)

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type BlogPostMeta,
  type DialectKey,
  type PostTypeKey,
  DIALECTS,
  POST_TYPES,
  classifyType,
  getDialectMeta,
} from "@/lib/blog-shared";
import blog from "@/components/marketing/Blog.module.css";
import { PostCover } from "./PostCover";

type ChipKey = "all" | DialectKey;
type TypeChipKey = "all" | PostTypeKey;

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function authorInitials(name?: string): string {
  if (!name) return "DP";
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "DP";
}

const PAGE_SIZE = 12;

export default function BlogIndexClient({
  posts,
  chipCounts,
  typeCounts,
}: {
  posts: BlogPostMeta[];
  chipCounts: Record<ChipKey, number>;
  typeCounts: Record<TypeChipKey, number>;
}) {
  const [activeChip, setActiveChip] = useState<ChipKey>("all");
  const [activeType, setActiveType] = useState<TypeChipKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"latest" | "popular" | "oldest">("latest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset the page window whenever the user changes a filter or sort
  // so the new result set starts from the top.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeChip, activeType, query, sort]);

  const filtered = useMemo(() => {
    let arr = posts;
    if (activeChip !== "all") arr = arr.filter((p) => p.dialect === activeChip);
    if (activeType !== "all") {
      arr = arr.filter((p) => (p.type ?? classifyType(p)) === activeType);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q),
      );
    }
    if (sort === "oldest") {
      arr = [...arr].sort((a, b) => (a.date < b.date ? -1 : 1));
    } else if (sort === "popular") {
      // No analytics-backed popularity yet. Approximate by reading time
      // ascending: short reads tend to get the most clicks.
      arr = [...arr].sort((a, b) => (a.readingMinutes ?? 0) - (b.readingMinutes ?? 0));
    }
    return arr;
  }, [posts, activeChip, activeType, query, sort]);

  const chips: Array<{ key: ChipKey; label: string; flag?: string }> = [
    { key: "all", label: "All" },
    ...DIALECTS.map((d) => ({ key: d.key as ChipKey, label: d.label, flag: d.flag })),
  ];

  const typeChips: Array<{ key: TypeChipKey; label: string }> = [
    { key: "all", label: "All types" },
    ...POST_TYPES.map((t) => ({ key: t.key as TypeChipKey, label: t.label })),
  ];

  return (
    <>
      {/* Toolbar row 1: dialect chips, search, RSS */}
      <div className={blog.toolbar}>
        <div className={blog.chips}>
          {chips.map((c) => {
            const active = activeChip === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setActiveChip(c.key)}
                className={`${blog.chip} ${active ? blog.chipActive : ""}`}
              >
                {c.flag && <span aria-hidden>{c.flag}</span>}
                {c.label}
                <span className={blog.chipCount}>{chipCounts[c.key] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <label className={blog.search}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Search notes, words, languages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className={blog.kbd}>⌘ K</span>
        </label>
        <a
          href="/blog/rss.xml"
          className={blog.rssBtn}
          aria-label="Subscribe via RSS"
          title="RSS feed"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19 7.38 20 6.18 20A2.18 2.18 0 0 1 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1Z" />
          </svg>
          RSS
        </a>
      </div>

      {/* Toolbar row 2: post-type chips */}
      <div className={blog.toolbarTypes}>
        {typeChips.map((c) => {
          const active = activeType === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveType(c.key)}
              className={`${blog.typeChip} ${active ? blog.typeChipActive : ""}`}
            >
              {c.label}
              <span className={blog.chipCount}>{typeCounts[c.key] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Section head + sort */}
      <div className={blog.sectionHead}>
        <div>
          <p className={blog.sectionOverline}>Latest</p>
          <h3 className={blog.sectionHeadTitle}>
            Fresh from the <span style={{ color: "#fcd34d" }}>desk.</span>
          </h3>
        </div>
        <div className={blog.sort}>
          {(["latest", "popular", "oldest"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`${blog.sortBtn} ${sort === s ? blog.sortBtnActive : ""}`}
            >
              {s === "latest" ? "Latest" : s === "popular" ? "Popular" : "Oldest"}
            </button>
          ))}
        </div>
      </div>

      {/* Post list. An inline app cross-sell banner is injected once per
          page window (after the 5th card) so cold SEO traffic always sees
          a CTA without reaching the footer. */}
      <div className={blog.postList}>
        {filtered.length === 0 && (
          <p style={{ color: "rgba(255,255,255,0.65)", padding: "32px 0" }}>
            No posts match those filters.
          </p>
        )}
        {filtered.slice(0, visibleCount).map((post, i) => {
          const dialect = getDialectMeta(post.dialect ?? "essays");
          return (
            <Fragment key={post.slug}>
              <Link href={`/blog/${post.slug}`} className={blog.postCard}>
                <PostCover post={post} />
                <div className={blog.postBody}>
                  <span className={blog.postByline}>
                    <span className={blog.avatar}>{authorInitials(post.author)}</span>
                    By {post.author ?? "Digital Polyglot"}
                    <span className={blog.bylineSep}>·</span>
                    <span>{formatDate(post.date)}</span>
                  </span>
                  <h4 className={blog.postBodyTitle}>{post.title}</h4>
                  {post.excerpt && <p className={blog.postBodyExcerpt}>{post.excerpt}</p>}
                  <div className={blog.postMeta}>
                    <span>{post.readingMinutes ?? 4} min read</span>
                    <span className={blog.langDot}>
                      <span aria-hidden>{dialect.flag}</span>
                      {dialect.label}
                    </span>
                  </div>
                </div>
              </Link>
              {i === 4 && (
                <Link
                  href="/sign-up"
                  className={blog.crossSell}
                  aria-label="Get the Digital Polyglot app"
                >
                  <div className={blog.crossSellCopy}>
                    <span className={blog.crossSellKicker}>
                      <span className={blog.crossSellDot} />
                      Read inside the app
                    </span>
                    <h4 className={blog.crossSellTitle}>
                      Stop reading <em>about</em> the language.
                      <br />
                      <span style={{ color: "#fcd34d" }}>Start reading in it.</span>
                    </h4>
                    <p className={blog.crossSellSub}>
                      Short stories with word-synced narration and tap-to-translate vocab.
                    </p>
                  </div>
                  <span className={blog.crossSellCta}>
                    Get started free
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              )}
            </Fragment>
          );
        })}
      </div>

      {filtered.length > visibleCount && (
        <div className={blog.loadMoreWrap}>
          <button
            type="button"
            className={blog.loadMore}
            onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
          >
            Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
            <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: 6 }}>
              ({filtered.length - visibleCount} left)
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
