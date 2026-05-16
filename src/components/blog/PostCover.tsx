// Per-post cover. Uses the real hero image if present, otherwise
// renders the dialect-tinted placeholder + glyph + badge described in
// the handoff (design_handoff_blog_redesign).
import Image from "next/image";
import type { CSSProperties } from "react";
import {
  type BlogPostMeta,
  getDialectMeta,
} from "@/lib/blog-shared";
import blog from "@/components/marketing/Blog.module.css";

function coverGlyph(post: BlogPostMeta): string {
  // Prefer a leading number in the title (e.g. "50", "30") as the glyph.
  const num = post.title.match(/\b\d{1,3}\b/);
  if (num) return num[0];
  // Otherwise use the first two letters of the first content word.
  const word = post.title.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/)[0] ?? "";
  return word.slice(0, 2).toUpperCase() || "DP";
}

function coverBadge(post: BlogPostMeta): string {
  const t = post.title.toLowerCase();
  if (/phrase|expression|saying|idiom/.test(t)) return "Phrases";
  if (/verb|adjective|noun|grammar|conjugat/.test(t)) return "Grammar";
  if (/vocab|word|slang/.test(t)) return "Vocab";
  if (/guide|how to|tips|ways/.test(t)) return "Guide";
  return "Essay";
}

export function PostCover({ post }: { post: BlogPostMeta }) {
  const dialect = getDialectMeta(post.dialect ?? "essays");
  const style = {
    "--gradA": dialect.gradient[0],
    "--gradB": dialect.gradient[1],
  } as CSSProperties;
  return (
    <div className={blog.postCover} style={style}>
      {post.hero ? (
        <Image
          src={post.hero}
          alt=""
          fill
          sizes="220px"
          className={blog.postCoverImage}
        />
      ) : (
        <span className={blog.postCoverGlyph}>{coverGlyph(post)}</span>
      )}
      <span className={blog.postCoverBadge}>{coverBadge(post)}</span>
    </div>
  );
}
