import type { MetadataRoute } from "next";

const SITE = "https://www.digitalpolyglot.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/studio", "/studio/", "/api/", "/auth/", "/sign-in", "/sign-up"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
