import { listBlogPosts, getBlogPost, renderBlogContent } from "@/lib/blog";

const SITE = "https://www.digitalpolyglot.com";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = listBlogPosts().slice(0, 20); // most recent 20

  const items = await Promise.all(
    posts.map(async (meta) => {
      const post = getBlogPost(meta.slug);
      const html = post ? await renderBlogContent(post.content) : "";
      return `
    <item>
      <title>${escapeXml(meta.title)}</title>
      <link>${SITE}/blog/${meta.slug}</link>
      <guid isPermaLink="true">${SITE}/blog/${meta.slug}</guid>
      <pubDate>${new Date(meta.date).toUTCString()}</pubDate>
      <description>${escapeXml(meta.excerpt ?? "")}</description>
      <content:encoded><![CDATA[${html}]]></content:encoded>
    </item>`;
    }),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Digital Polyglot Blog</title>
    <link>${SITE}/blog</link>
    <description>Notes from the library — vocab posts, language deep-dives, and behind-the-scenes of how we build the catalogue.</description>
    <language>en</language>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
