import type { NextConfig } from "next";

const WP_ORIGIN = process.env.WP_ORIGIN_HOST ?? "https://wp.digitalpolyglot.com";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Disable Next.js's automatic 308 from /path/ to /path so the blog
  // middleware can proxy the WP origin with the trailing slash WP
  // expects, without the user being redirected mid-flight.
  skipTrailingSlashRedirect: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      // 🖼️ Sanity CDN
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**",
      },
      // 🖼️ Digital Polyglot CDN
      {
        protocol: "https",
        hostname: "cdn.digitalpolyglot.com",
        pathname: "/**",
      },
      // Temporary R2 public development URL
      {
        protocol: "https",
        hostname: "pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      { source: "/wp-content/:path*", destination: `${WP_ORIGIN}/wp-content/:path*` },
      { source: "/wp-includes/:path*", destination: `${WP_ORIGIN}/wp-includes/:path*` },
      { source: "/wp-json/:path*", destination: `${WP_ORIGIN}/wp-json/:path*` },
      { source: "/sitemap.xml", destination: `${WP_ORIGIN}/sitemap.xml` },
      { source: "/sitemap_index.xml", destination: `${WP_ORIGIN}/sitemap_index.xml` },
      { source: "/:slug(\\w+-sitemap).xml", destination: `${WP_ORIGIN}/:slug.xml` },
    ];
  },
  async redirects() {
    return [
      { source: "/about-us", destination: "/", permanent: true },
      { source: "/about-us/", destination: "/", permanent: true },
      { source: "/careers", destination: "/", permanent: true },
      { source: "/careers/", destination: "/", permanent: true },
    ];
  },
  async headers() {
    // WordPress hard-codes http:// in some image URLs and srcsets. The browser
    // blocks those as mixed content on our https pages. This header tells the
    // browser to silently upgrade http→https for any resource the blog HTML
    // references, so the images load through our wp-content rewrite without
    // touching WordPress siteurl settings.
    return [
      {
        source: "/blog",
        headers: [{ key: "Content-Security-Policy", value: "upgrade-insecure-requests" }],
      },
      {
        source: "/blog/:path*",
        headers: [{ key: "Content-Security-Policy", value: "upgrade-insecure-requests" }],
      },
    ];
  },
};

export default nextConfig;
