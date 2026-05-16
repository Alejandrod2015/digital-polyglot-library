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

export type BlogPostMeta = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  author?: string;
  tags?: string[];
  hero?: string;
};

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
  return {
    slug,
    title: String(data.title ?? slug),
    date: String(data.date ?? ""),
    excerpt: String(data.excerpt ?? ""),
    author: data.author as string | undefined,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
    hero: data.hero as string | undefined,
    content,
  };
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
    // Allow `slug:` frontmatter override
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
