import type { MetadataRoute } from "next";
import { listBlogPosts } from "@/lib/blog";

const SITE = "https://www.digitalpolyglot.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = listBlogPosts();
  const now = new Date().toISOString();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/beta`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  // Posts canonicalised to another domain are deliberately absent: listing a
  // URL in the sitemap asks Google to index it, which contradicts the canonical
  // pointing away from it.
  const postRoutes: MetadataRoute.Sitemap = posts
    .filter((p) => !p.canonicalUrl)
    .map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      lastModified: p.date ? new Date(p.date).toISOString() : now,
      changeFrequency: "monthly",
      priority: 0.6,
    }));

  return [...staticRoutes, ...postRoutes];
}
