// Server-side blog loader. Reads MDX files from content/blog/, parses
// frontmatter, renders markdown to HTML. Client-safe types and helpers
// live in src/lib/blog-shared.ts so the toolbar can import them without
// pulling node:fs into the client bundle.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeStringify from "rehype-stringify";

import {
  type BlogPostMeta,
  classifyDialect,
  classifyType,
  computeReadingMinutes,
} from "@/lib/blog-shared";

export type {
  BlogPostMeta,
  DialectKey,
  PostTypeKey,
  BlogSeries,
} from "@/lib/blog-shared";
export {
  DIALECTS,
  POST_TYPES,
  classifyDialect,
  classifyType,
  computeReadingMinutes,
  getBlogSeries,
  getDialectCounts,
  getDialectMeta,
  getFeaturedPost,
  getPostTypeCounts,
} from "@/lib/blog-shared";

export type BlogPost = BlogPostMeta & {
  content: string;
};

const CONTENT_DIR = path.join(process.cwd(), "content", "blog");

function readAllFiles(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((name) => name.endsWith(".mdx") || name.endsWith(".md"));
}

function parseFile(filename: string): BlogPost {
  const filePath = path.join(CONTENT_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);
  const slug = (data.slug as string | undefined) ?? filename.replace(/\.mdx?$/, "");
  const post: BlogPost = {
    slug,
    title: String(data.title ?? slug),
    date: String(data.date ?? ""),
    excerpt: String(data.excerpt ?? ""),
    seoTitle: data.seoTitle ? String(data.seoTitle) : undefined,
    metaDescription: data.metaDescription ? String(data.metaDescription) : undefined,
    author: data.author as string | undefined,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
    categories: Array.isArray(data.categories) ? (data.categories as string[]) : undefined,
    hero: data.hero as string | undefined,
    content,
  };
  post.readingMinutes = computeReadingMinutes(content);
  post.dialect = classifyDialect(post);
  post.type = classifyType(post);
  return post;
}

export function listBlogPosts(): BlogPostMeta[] {
  const posts = readAllFiles()
    .map(parseFile)
    .map(({ content: _content, ...meta }) => meta);
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getBlogPost(slug: string): BlogPost | null {
  const file = readAllFiles().find((name) => {
    const stem = name.replace(/\.mdx?$/, "");
    if (stem === slug) return true;
    const post = parseFile(name);
    return post.slug === slug;
  });
  if (!file) return null;
  return parseFile(file);
}

export function getAllBlogSlugs(): string[] {
  return readAllFiles().map((name) => {
    const post = parseFile(name);
    return post.slug;
  });
}

export async function renderBlogContent(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}
