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
  type HeroCredit,
  classifyDialect,
  classifyType,
  computeReadingMinutes,
} from "@/lib/blog-shared";

export type {
  BlogPostMeta,
  HeroCredit,
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

/**
 * Un credito solo cuenta si trae las tres cosas. Media atribucion (autor sin
 * licencia, licencia sin ficha) no cumple la licencia y ademas se veria como
 * una linea rota debajo de la foto, asi que se descarta entera.
 */
function parseHeroCredit(raw: unknown): HeroCredit | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const author = typeof r.author === "string" ? r.author.trim() : "";
  const licence = typeof r.licence === "string" ? r.licence.trim() : "";
  const source = typeof r.source === "string" ? r.source.trim() : "";
  if (!author || !licence || !source) return undefined;
  return { author, licence, source };
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
    canonicalUrl: data.canonicalUrl ? String(data.canonicalUrl) : undefined,
    author: data.author as string | undefined,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
    categories: Array.isArray(data.categories) ? (data.categories as string[]) : undefined,
    hero: data.hero as string | undefined,
    heroCredit: parseHeroCredit(data.heroCredit),
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
