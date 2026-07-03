import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllBlogSlugs, getBlogPost, renderBlogContent, type BlogPost } from "@/lib/blog";
import landing from "@/components/marketing/LandingPage.module.css";
import blog from "@/components/marketing/Blog.module.css";
import MarketingNav from "@/components/marketing/MarketingNav";
import ReadingProgress from "@/components/blog/ReadingProgress";
import InlineNewsletter from "@/components/blog/InlineNewsletter";

// Canonical host for the blog. Kept in sync with src/app/sitemap.ts so the
// canonical URL, the sitemap URL and the URL Google actually indexes all
// match (https, www, no trailing slash).
const SITE = "https://www.digitalpolyglot.com";

// Absolute URL for an asset stored as either a relative path or a full URL in
// frontmatter. JSON-LD and OpenGraph both require absolute image URLs.
function absoluteUrl(pathOrUrl: string | undefined): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${SITE}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

// BlogPosting structured data. The pre-migration blog exposed schema; the MDX
// rebuild dropped it, removing the rich-result and entity signals Google had.
// This restores an Article/BlogPosting graph per post.
function blogPostingJsonLd(post: BlogPost): Record<string, unknown> {
  const url = `${SITE}/blog/${post.slug}`;
  const image = absoluteUrl(post.hero);
  const published = post.date || undefined;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.seoTitle ?? post.title,
    description: post.metaDescription ?? post.excerpt,
    ...(image ? { image } : {}),
    ...(published ? { datePublished: published, dateModified: published } : {}),
    author: { "@type": "Organization", name: post.author ?? "Digital Polyglot", url: SITE },
    publisher: {
      "@type": "Organization",
      name: "Digital Polyglot",
      logo: { "@type": "ImageObject", url: `${SITE}/favicon/apple-touch-icon.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    inLanguage: "en",
  };
}

// Splits the rendered article HTML so we can insert the inline newsletter
// at a natural break (the second <h2>, falling back to the 6th </p>).
// Reading-research consistently shows mid-article CTAs convert 3-5x better
// than footer-only equivalents.
function splitForInlineCta(html: string): [string, string] {
  const headings = [...html.matchAll(/<\/h2>/g)];
  if (headings.length >= 2) {
    const idx = headings[1].index! + "</h2>".length;
    return [html.slice(0, idx), html.slice(idx)];
  }
  const paras = [...html.matchAll(/<\/p>/g)];
  if (paras.length >= 6) {
    const idx = paras[5].index! + "</p>".length;
    return [html.slice(0, idx), html.slice(idx)];
  }
  // Short article: skip the split so the CTA only shows the footer copy.
  return [html, ""];
}

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<Params> },
): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return { title: "Not found · Digital Polyglot Blog" };
  const url = `${SITE}/blog/${post.slug}`;
  const title = `${post.seoTitle ?? post.title} · Digital Polyglot`;
  const description = post.metaDescription ?? post.excerpt;
  const image = absoluteUrl(post.hero);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: "Digital Polyglot",
      ...(post.date ? { publishedTime: post.date } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage(
  { params }: { params: Promise<Params> },
) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();
  const html = await renderBlogContent(post.content);
  const [htmlBefore, htmlAfter] = splitForInlineCta(html);

  return (
    <main className={landing.page}>
      <MarketingNav />
      <ReadingProgress />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd(post)) }}
      />

      <article className={landing.frame}>
        <div className={blog.post}>
          <div className={blog.postKicker}>
            <Link href="/blog">Blog</Link>
            <span>·</span>
            <span>{formatDate(post.date)}</span>
          </div>
          <h1 className={blog.postTitle}>{post.title}</h1>
          {post.excerpt && (
            <p className={blog.postSub}>{post.excerpt}</p>
          )}
          {post.hero && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={blog.postHero} src={post.hero} alt="" />
          )}
          <div
            className={blog.prose}
            dangerouslySetInnerHTML={{ __html: htmlBefore }}
          />
          {htmlAfter && (
            <>
              <InlineNewsletter />
              <div
                className={blog.prose}
                dangerouslySetInnerHTML={{ __html: htmlAfter }}
              />
            </>
          )}
        </div>
      </article>
    </main>
  );
}
