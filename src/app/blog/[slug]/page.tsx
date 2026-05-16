import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllBlogSlugs, getBlogPost, renderBlogContent } from "@/lib/blog";
import landing from "@/components/marketing/LandingPage.module.css";
import blog from "@/components/marketing/Blog.module.css";

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
  return {
    title: `${post.title} · Digital Polyglot`,
    description: post.excerpt,
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

  return (
    <main className={landing.page}>
      <nav className={landing.nav}>
        <div className={`${landing.frame} ${landing.navInner}`}>
          <Link href="/" className={landing.brand}>
            Digital Polyglot
          </Link>
          <div className={landing.navLinks}>
            <Link href="/blog">Blog</Link>
            <Link href="/#features">Features</Link>
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
          <div
            className={blog.prose}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </article>
    </main>
  );
}
