"use client";

// Client-side toolbar (chip filter + free-text search + sort) for the
// blog index. The server passes the full post list; this component
// renders the filtered subset.
//
// Cards/sidebar markup is generated server-side and passed down as a
// children render-function so we keep the JSX DRY without sending big
// HTML strings over the wire.

import { useMemo, useState } from "react";
import Link from "next/link";
import { type BlogPostMeta, type DialectKey, DIALECTS, getDialectMeta } from "@/lib/blog-shared";
import blog from "@/components/marketing/Blog.module.css";
import { PostCover } from "./PostCover";

type ChipKey = "all" | DialectKey;

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

export default function BlogIndexClient({
  posts,
  chipCounts,
}: {
  posts: BlogPostMeta[];
  chipCounts: Record<ChipKey, number>;
}) {
  const [activeChip, setActiveChip] = useState<ChipKey>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"latest" | "popular" | "oldest">("latest");

  const filtered = useMemo(() => {
    let arr = posts;
    if (activeChip !== "all") arr = arr.filter((p) => p.dialect === activeChip);
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
      // ascending — short reads tend to get the most clicks.
      arr = [...arr].sort((a, b) => (a.readingMinutes ?? 0) - (b.readingMinutes ?? 0));
    }
    return arr;
  }, [posts, activeChip, query, sort]);

  const chips: Array<{ key: ChipKey; label: string; flag?: string }> = [
    { key: "all", label: "All" },
    ...DIALECTS.map((d) => ({ key: d.key as ChipKey, label: d.label, flag: d.flag })),
  ];

  return (
    <>
      {/* Toolbar */}
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

      {/* Post list */}
      <div className={blog.postList}>
        {filtered.length === 0 && (
          <p style={{ color: "rgba(255,255,255,0.65)", padding: "32px 0" }}>
            No posts match those filters.
          </p>
        )}
        {filtered.map((post) => {
          const dialect = getDialectMeta(post.dialect ?? "essays");
          return (
            <Link key={post.slug} href={`/blog/${post.slug}`} className={blog.postCard}>
              <PostCover post={post} />
              <div className={blog.postBody}>
                <h4 className={blog.postBodyTitle}>{post.title}</h4>
                {post.excerpt && <p className={blog.postBodyExcerpt}>{post.excerpt}</p>}
                <div className={blog.postMeta}>
                  <span className={blog.postMetaAuthor}>
                    <span className={blog.avatar}>{authorInitials(post.author)}</span>
                    {post.author ?? "Digital Polyglot"}
                  </span>
                  <span className={blog.metaDot} />
                  <span>{formatDate(post.date)}</span>
                  <span className={blog.metaDot} />
                  <span>{post.readingMinutes ?? 4} min read</span>
                  <span className={blog.langDot}>
                    <span aria-hidden>{dialect.flag}</span>
                    {dialect.label}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
