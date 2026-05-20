import type { Metadata } from "next";
import Link from "next/link";
import {
  type BlogPostMeta,
  type DialectKey,
  type PostTypeKey,
  getBlogSeries,
  getDialectCounts,
  getDialectMeta,
  getFeaturedPost,
  getPostTypeCounts,
  listBlogPosts,
} from "@/lib/blog";
import landing from "@/components/marketing/LandingPage.module.css";
import blog from "@/components/marketing/Blog.module.css";
import BlogIndexClient from "@/components/blog/BlogIndexClient";
import MarketingNav from "@/components/marketing/MarketingNav";

export const metadata: Metadata = {
  title: "Notes from the library · Digital Polyglot",
  description:
    "Vocab drops, language deep-dives, and the occasional behind-the-scenes from how we build the catalogue.",
};

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function shortDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function BlogIndex() {
  const posts: BlogPostMeta[] = listBlogPosts();
  const featured = getFeaturedPost(posts);
  // Exclude featured from main list to avoid duplication.
  const rest = featured ? posts.filter((p) => p.slug !== featured.slug) : posts;
  const dialectCounts = getDialectCounts(posts);
  const chipCounts: Record<"all" | DialectKey, number> = {
    all: posts.length,
    ...dialectCounts,
  };
  const typeCountsRaw = getPostTypeCounts(posts);
  const typeCounts: Record<"all" | PostTypeKey, number> = {
    all: posts.length,
    ...typeCountsRaw,
  };
  const dialectsCount = Object.values(dialectCounts).filter((n) => n > 0).length;
  const series = getBlogSeries(posts);
  const latestDate = posts[0]?.date ?? "";
  const mostRead = posts.slice(0, 5); // No analytics yet → newest 5 as proxy.

  return (
    <main className={landing.page}>
      <MarketingNav />

      <div className={landing.frame}>
        {/* Hero */}
        <header className={blog.hero}>
          <div>
            <span className={landing.kicker}>
              <span className={landing.kickerDot} />
              The library journal
            </span>
            <h1 className={blog.heroTitle}>
              Notes from the <span className={landing.lime}>library.</span>
            </h1>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <p className={blog.heroSub}>
              Vocab drops, language deep-dives, and the occasional behind-the-scenes
              from how we build the catalogue.
            </p>
            <div className={blog.heroMeta}>
              <div className={blog.stat}>
                <b>{posts.length}</b>
                <span>Posts</span>
              </div>
              <div className={blog.stat}>
                <b>{dialectsCount}</b>
                <span>Dialects</span>
              </div>
              <div className={blog.stat}>
                <b>{series.length}</b>
                <span>Series</span>
              </div>
              <div className={blog.stat}>
                <b>{shortDate(latestDate)}</b>
                <span>Latest</span>
              </div>
            </div>
          </div>
        </header>

        {/* Featured */}
        {featured && (
          <section className={blog.featuredWrap}>
            <Link href={`/blog/${featured.slug}`} className={blog.featured}>
              <div
                className={blog.featuredCover}
                style={
                  featured.hero
                    ? {
                        background: `url(${featured.hero}) center/cover`,
                      }
                    : undefined
                }
              >
                {!featured.hero && (
                  <span className={blog.featuredCoverLabel}>
                    [ COVER · {getDialectMeta(featured.dialect ?? "essays").short} ]
                  </span>
                )}
              </div>
              <div className={blog.featuredBody}>
                <div className={blog.featuredKicker}>
                  <span className={blog.featuredMark}>Featured</span>
                  <span className={blog.sep}>·</span>
                  <span>{formatDate(featured.date).toUpperCase()}</span>
                  <span className={blog.sep}>·</span>
                  <span>BY {(featured.author ?? "Digital Polyglot").toUpperCase()}</span>
                </div>
                <h2 className={blog.featuredTitle}>{featured.title}</h2>
                {featured.excerpt && (
                  <p className={blog.featuredExcerpt}>{featured.excerpt}</p>
                )}
                <div className={blog.postMeta}>
                  <span>{featured.readingMinutes ?? 6} min read</span>
                  <span className={blog.metaDot} />
                  <span>{getDialectMeta(featured.dialect ?? "essays").short}</span>
                  <span className={blog.langDot}>
                    <span aria-hidden>{getDialectMeta(featured.dialect ?? "essays").flag}</span>
                    {getDialectMeta(featured.dialect ?? "essays").label}
                  </span>
                </div>
                <span className={blog.readLink}>
                  Read the guide
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Link>
          </section>
        )}

        {/* Main grid: post list (client toolbar) + sidebar */}
        <section className={blog.mainGrid}>
          <div>
            <BlogIndexClient
              posts={rest}
              chipCounts={chipCounts}
              typeCounts={typeCounts}
            />
          </div>

          <aside className={blog.sidebar}>
            {/* Most read */}
            <div className={blog.sideCard}>
              <div className={blog.sideHead}>
                <h5 className={blog.sideHeadTitle}>Most read</h5>
                <Link href="/blog" className={blog.sideHeadMore}>All ›</Link>
              </div>
              <div className={blog.popList}>
                {mostRead.map((post, i) => (
                  <Link key={post.slug} href={`/blog/${post.slug}`} className={blog.popItem}>
                    <span className={blog.popItemN}>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <h6 className={blog.popItemTitle}>{post.title}</h6>
                      <span className={blog.popItemMeta}>
                        {formatDate(post.date)} · {post.readingMinutes ?? 4} min
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Series */}
            {series.length > 0 && (
              <div className={blog.sideCard}>
                <div className={blog.sideHead}>
                  <h5 className={blog.sideHeadTitle}>Series</h5>
                  <Link href="/blog" className={blog.sideHeadMore}>All ›</Link>
                </div>
                <div className={blog.seriesList}>
                  {series.map((s) => (
                    <Link key={s.id} href="/blog" className={blog.seriesRow}>
                      <span className={blog.seriesFlag} aria-hidden>{s.flag}</span>
                      <div className={blog.seriesInfo}>
                        <b className={blog.seriesInfoName}>{s.name}</b>
                        <span className={blog.seriesInfoSub}>{s.subtitle}</span>
                      </div>
                      <span className={blog.seriesCount}>{s.count}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </section>

        {/* Newsletter */}
        <section className={blog.newsletter}>
          <div>
            <span className={landing.kicker}>
              <span className={landing.kickerDot} />
              Newsletter
            </span>
            <h3 className={blog.newsletterTitle}>
              Get the next note <span className={landing.lime}>in your inbox.</span>
            </h3>
            <p className={blog.newsletterCopy}>
              Roughly twice a month: a new word, a story excerpt, and what we&apos;re
              reading. No drip campaigns.
            </p>
          </div>
          <form
            className={blog.nlForm}
            action="https://shop.digitalpolyglot.com/newsletter"
            method="post"
          >
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
            />
            <button type="submit">Subscribe</button>
          </form>
        </section>
      </div>

      {/* Footer (slim, same vibe as the landing) */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.10)", padding: "32px 0 28px" }}>
        <div
          className={landing.frame}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            fontSize: 11.5,
            fontWeight: 800,
            color: "rgba(255,255,255,0.30)",
            letterSpacing: "0.06em",
          }}
        >
          <span>© {new Date().getFullYear()} Digital Polyglot</span>
          <nav style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <a href="https://shop.digitalpolyglot.com" style={{ color: "rgba(255,255,255,0.45)" }}>Shop</a>
            <Link href="/privacy" style={{ color: "rgba(255,255,255,0.45)" }}>Privacy</Link>
            <Link href="/terms" style={{ color: "rgba(255,255,255,0.45)" }}>Terms</Link>
            <Link href="/impressum" style={{ color: "rgba(255,255,255,0.45)" }}>Impressum</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
