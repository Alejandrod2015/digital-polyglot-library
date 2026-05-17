import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllBlogSlugs, getBlogPost, renderBlogContent } from "@/lib/blog";
import landing from "@/components/marketing/LandingPage.module.css";
import blog from "@/components/marketing/Blog.module.css";
import MarketingNav from "@/components/marketing/MarketingNav";

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
      <MarketingNav />

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
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </article>
    </main>
  );
}
