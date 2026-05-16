/**
 * Imports the WordPress blog into local MDX files under `content/blog/`
 * and downloads referenced images into `public/blog/<slug>/`.
 *
 * - Fetches all posts from wp-json/wp/v2/posts (paginated).
 * - Fetches the categories/tags index to resolve IDs to names.
 * - Resolves featured_media to a URL via wp-json/wp/v2/media/<id>.
 * - Converts the post HTML to Markdown with turndown after pre-cleaning
 *   the WordPress-specific noise (ez-toc TOC, wp-block button containers,
 *   wp-block-* class soup).
 * - Rewrites WP image URLs to local /blog/<slug>/<file> paths and
 *   downloads each image into public/blog/<slug>/.
 * - Writes one MDX file per post: content/blog/<slug>.mdx
 *
 * Run with: npx tsx scripts/importBlogFromWordPress.ts
 * Dry-run:  npx tsx scripts/importBlogFromWordPress.ts --dry
 * Limit N:  npx tsx scripts/importBlogFromWordPress.ts --limit=5
 */

import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import TurndownService from "turndown";
import sharp from "sharp";

const WP_HOST = "https://wp.digitalpolyglot.com";
const CONTENT_DIR = path.join(process.cwd(), "content", "blog");
const PUBLIC_DIR = path.join(process.cwd(), "public", "blog");

type WPPost = {
  id: number;
  date: string;
  modified: string;
  slug: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media: number;
  categories: number[];
  tags: number[];
};

type WPTerm = { id: number; name: string; slug: string };

type WPMedia = { id: number; source_url: string };

const DRY = process.argv.includes("--dry");
const LIMIT = (() => {
  const a = process.argv.find((x) => x.startsWith("--limit="));
  return a ? parseInt(a.slice("--limit=".length), 10) : Number.POSITIVE_INFINITY;
})();

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

async function fetchAllPages<T>(baseUrl: string, perPage = 100): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (true) {
    const url = `${baseUrl}?per_page=${perPage}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400) break; // page out of range
      throw new Error(`${res.status} for ${url}`);
    }
    const batch = (await res.json()) as T[];
    all.push(...batch);
    const totalPages = parseInt(res.headers.get("x-wp-totalpages") ?? "1", 10);
    if (page >= totalPages) break;
    page += 1;
  }
  return all;
}

function decodeEntities(html: string): string {
  return html
    .replace(/&#8217;/g, "’")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "-")
    .replace(/&#8230;/g, "...")
    .replace(/&hellip;/g, "...")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function stripWpNoise(html: string): string {
  // Drop ez-toc auto table of contents block (we re-anchor headings ourselves).
  // The ez-toc container closes with `</nav></div>`, not `</div></div>`, so
  // we anchor the end match on `</nav>` to avoid swallowing later sections.
  let out = html.replace(
    /<div[^>]*id=["']ez-toc-container["'][\s\S]*?<\/nav>\s*<\/div>/gi,
    "",
  );
  // Drop the ez-toc inline span markers around headings.
  out = out.replace(/<span[^>]*class=["'][^"']*ez-toc-section[^"']*["'][^>]*><\/span>/gi, "");
  // Drop empty <p></p> WordPress inserts between blocks.
  out = out.replace(/<p>\s*<\/p>/g, "");
  // Strip srcset / sizes / decoding / fetchpriority noise from <img> so the
  // turndown output is clean.
  out = out.replace(/\s+(srcset|sizes|decoding|fetchpriority|loading)="[^"]*"/gi, "");
  out = out.replace(/\s+class="wp-image-\d+"/gi, "");
  out = out.replace(/\s+style="[^"]*"/gi, "");
  out = out.replace(/\s+width="[^"]*"/gi, "");
  out = out.replace(/\s+height="[^"]*"/gi, "");
  return out;
}

function htmlToMarkdown(html: string): string {
  const cleaned = stripWpNoise(decodeEntities(html));
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });
  // Unwrap <figure> around images so we just get the image markdown.
  td.addRule("figure-image", {
    filter: (node) => node.nodeName === "FIGURE",
    replacement: (_content, node) => {
      const img = (node as HTMLElement).querySelector?.("img");
      if (!img) return _content;
      const src = img.getAttribute("src") ?? "";
      const alt = img.getAttribute("alt") ?? "";
      return `\n\n![${alt}](${src})\n\n`;
    },
  });
  // wp-block-button containers -> single markdown link.
  td.addRule("wp-button", {
    filter: (node) => {
      const el = node as HTMLElement;
      const className = el.getAttribute?.("class") ?? "";
      return el.nodeName === "DIV" && className.includes("wp-block-buttons");
    },
    replacement: (_content, node) => {
      const links = Array.from(
        (node as HTMLElement).querySelectorAll?.("a") ?? [],
      );
      if (!links.length) return "";
      return (
        "\n\n" +
        links
          .map((a) => {
            const href = a.getAttribute("href") ?? "";
            const text = a.textContent?.trim() ?? "";
            return `[${text}](${href})`;
          })
          .join(" ") +
        "\n\n"
      );
    },
  });
  return td
    .turndown(cleaned)
    // Strip the redundant `**` wrap from headings (WP loved `<h2><strong>`).
    .replace(/^(#{1,6})\s+\*\*([^*\n]+?)\*\*\s*$/gm, "$1 $2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function downloadAndOptimize(
  url: string,
  destWebp: string,
): Promise<void> {
  fs.mkdirSync(path.dirname(destWebp), { recursive: true });
  if (fs.existsSync(destWebp)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Resize to max 1200px wide, convert to webp@80 to keep the repo lean.
  // 1200px is enough for retina at the blog's ~720px column width.
  await sharp(buf)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toFile(destWebp);
}

function imageBaseName(url: string): string {
  const u = new URL(url);
  return path.basename(u.pathname);
}

function toWebpName(original: string): string {
  // Replace any extension with .webp
  return original.replace(/\.(png|jpg|jpeg|gif|webp)$/i, "") + ".webp";
}

async function rewriteAndDownloadImages(
  slug: string,
  markdown: string,
): Promise<{ md: string; count: number }> {
  // Capture both http and https variants pointing at our WP origin or the
  // www.digitalpolyglot.com mirror that WordPress emits.
  const urlRe = /https?:\/\/(?:www\.|wp\.)?digitalpolyglot\.com\/wp-content\/uploads\/[^)\s"']+/g;
  const matches = Array.from(new Set(markdown.match(urlRe) ?? []));
  let count = 0;
  for (const original of matches) {
    const webpName = toWebpName(imageBaseName(original));
    const localPath = path.join(PUBLIC_DIR, slug, webpName);
    const publicPath = `/blog/${slug}/${webpName}`;
    if (!DRY) {
      try {
        // Always fetch via https://www.digitalpolyglot.com which is the
        // canonical origin; the wp-content path is identical.
        const canonical = original
          .replace(/^http:\/\//, "https://")
          .replace("wp.digitalpolyglot.com", "www.digitalpolyglot.com");
        await downloadAndOptimize(canonical, localPath);
        count += 1;
      } catch (err) {
        console.warn(`  [skip image] ${original}: ${(err as Error).message}`);
        continue;
      }
    }
    // Escape special regex chars in the URL for the global replace.
    const safe = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    markdown = markdown.replace(new RegExp(safe, "g"), publicPath);
  }
  return { md: markdown, count };
}

function frontmatter(record: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(record)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      lines.push(`${k}: [${v.map((x) => JSON.stringify(x)).join(", ")}]`);
    } else if (typeof v === "string") {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push("---");
  return lines.join("\n") + "\n";
}

async function main() {
  console.log(`Mode: ${DRY ? "DRY RUN" : "WRITE"}; limit: ${LIMIT === Infinity ? "all" : LIMIT}`);

  if (!DRY) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  console.log("Fetching categories + tags...");
  const [categories, tags] = await Promise.all([
    fetchAllPages<WPTerm>(`${WP_HOST}/wp-json/wp/v2/categories`),
    fetchAllPages<WPTerm>(`${WP_HOST}/wp-json/wp/v2/tags`),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));
  const tagById = new Map(tags.map((t) => [t.id, t.name]));
  console.log(`  ${categories.length} categories, ${tags.length} tags`);

  console.log("Fetching posts...");
  const posts = await fetchAllPages<WPPost>(`${WP_HOST}/wp-json/wp/v2/posts`);
  console.log(`  ${posts.length} posts total`);

  const mediaCache = new Map<number, string>();
  async function resolveMedia(id: number): Promise<string | null> {
    if (id === 0) return null;
    if (mediaCache.has(id)) return mediaCache.get(id) ?? null;
    try {
      const m = await fetchJson<WPMedia>(`${WP_HOST}/wp-json/wp/v2/media/${id}`);
      mediaCache.set(id, m.source_url);
      return m.source_url;
    } catch (err) {
      console.warn(`  [media miss] ${id}: ${(err as Error).message}`);
      return null;
    }
  }

  let written = 0;
  const errors: string[] = [];

  for (const post of posts.slice(0, LIMIT)) {
    try {
      const slug = post.slug;
      console.log(`- ${slug}`);

      // Title
      const title = decodeEntities(post.title.rendered).replace(/<[^>]+>/g, "").trim();

      // Excerpt
      const excerpt = decodeEntities(post.excerpt.rendered)
        .replace(/<[^>]+>/g, "")
        .replace(/\[…\]|\[\&hellip;\]/g, "...")
        .trim();

      // Content
      let markdown = htmlToMarkdown(post.content.rendered);
      const imageReport = await rewriteAndDownloadImages(slug, markdown);
      markdown = imageReport.md;

      // Featured media
      const featuredUrl = await resolveMedia(post.featured_media);
      let hero: string | undefined;
      if (featuredUrl) {
        const webpName = toWebpName(imageBaseName(featuredUrl));
        const localPath = path.join(PUBLIC_DIR, slug, webpName);
        const publicPath = `/blog/${slug}/${webpName}`;
        if (!DRY) {
          try {
            await downloadAndOptimize(featuredUrl, localPath);
          } catch (err) {
            console.warn(`  [hero miss] ${slug}: ${(err as Error).message}`);
          }
        }
        hero = publicPath;
      }

      const mdx = frontmatter({
        title,
        slug,
        date: post.date.slice(0, 10),
        excerpt,
        hero,
        tags: post.tags.map((id) => tagById.get(id)).filter(Boolean),
        categories: post.categories.map((id) => categoryById.get(id)).filter(Boolean),
        wp_id: post.id,
      }) + "\n" + markdown + "\n";

      if (!DRY) {
        fs.writeFileSync(path.join(CONTENT_DIR, `${slug}.mdx`), mdx);
      }
      written += 1;
      console.log(`  body: ${markdown.length} chars, images: ${imageReport.count}`);
    } catch (err) {
      const msg = `${post.slug}: ${(err as Error).message}`;
      console.error(`  [post error] ${msg}`);
      errors.push(msg);
    }
  }

  console.log("");
  console.log(`Wrote ${written} posts. Errors: ${errors.length}.`);
  if (errors.length) {
    console.log("Errors:");
    for (const e of errors) console.log(`  - ${e}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
