import type { Metadata } from "next";
import Link from "next/link";
import { listBlogPosts } from "@/lib/blog";
import landing from "@/components/marketing/LandingPage.module.css";
import blog from "@/components/marketing/Blog.module.css";

export const metadata: Metadata = {
  title: "Blog · Digital Polyglot",
  description:
    "Notes on language learning, our catalogue, and the craft of building stories that read with you.",
};

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

export default function BlogIndex() {
  const posts = listBlogPosts();
  return (
    <main className={landing.page}>
      <nav className={landing.nav}>
        <div className={`${landing.frame} ${landing.navInner}`}>
          <Link href="/" className={landing.brand}>
            Digital Polyglot
          </Link>
          <div className={landing.navLinks}>
            <Link href="/#features">Features</Link>
            <Link href="/#languages">Languages</Link>
            <Link href="/beta">iPhone beta</Link>
          </div>
          <div className={landing.navCta}>
            <Link
              href="/sign-in"
              className={`${landing.btn} ${landing.btnQuiet}`}
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className={`${landing.btn} ${landing.btnPrimary}`}
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      <header className={landing.frame}>
        <div className={blog.indexHero}>
          <span className={landing.kicker}>
            <span className={landing.kickerDot} />
            Blog
          </span>
          <h1 className={blog.indexTitle}>
            Notes from the <span className={landing.lime}>library.</span>
          </h1>
          <p className={blog.indexLead}>
            Vocab posts, language deep-dives, and the occasional behind-the-scenes
            of how we build the catalogue.
          </p>
        </div>
      </header>

      <section className={landing.frame}>
        <div className={blog.list}>
          {posts.length === 0 && (
            <p className={blog.cardExcerpt} style={{ textAlign: "center" }}>
              No posts yet. Check back soon.
            </p>
          )}
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className={blog.card}>
              <div className={blog.cardMeta}>
                <span>{formatDate(p.date)}</span>
                {p.tags?.[0] && (
                  <>
                    <span>·</span>
                    <span>{p.tags[0]}</span>
                  </>
                )}
              </div>
              <h2 className={blog.cardTitle}>{p.title}</h2>
              {p.excerpt && <p className={blog.cardExcerpt}>{p.excerpt}</p>}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
