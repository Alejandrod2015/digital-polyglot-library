import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const WP_ORIGIN = process.env.WP_ORIGIN_HOST ?? "https://wp.digitalpolyglot.com";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
  async redirects() {
    return [
      { source: "/about-us", destination: "/", permanent: true },
      { source: "/about-us/", destination: "/", permanent: true },
      { source: "/careers", destination: "/", permanent: true },
      { source: "/careers/", destination: "/", permanent: true },
    ];
  },
  async rewrites() {
    // WordPress assets and PHP endpoints that the middleware matcher excludes
    // because they have file extensions. Without these the proxied WP pages
    // (/cart, /wp-admin, etc.) would render with broken images and the WP
    // backend would be unreachable from the canonical domain.
    return [
      { source: "/wp-content/:path*", destination: `${WP_ORIGIN}/wp-content/:path*` },
      { source: "/wp-includes/:path*", destination: `${WP_ORIGIN}/wp-includes/:path*` },
      { source: "/wp-json/:path*", destination: `${WP_ORIGIN}/wp-json/:path*` },
      { source: "/wp-login.php", destination: `${WP_ORIGIN}/wp-login.php` },
      { source: "/wp-cron.php", destination: `${WP_ORIGIN}/wp-cron.php` },
      { source: "/xmlrpc.php", destination: `${WP_ORIGIN}/xmlrpc.php` },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "digital-polyglot",
  project: "digital-polyglot",
  silent: !process.env.CI,
  // widenClientFileUpload uploads source maps for ALL client bundles
  // (including node_modules), which added ~30 CPU-min per build × ~97
  // builds/month = ~$15/mo of pure overage. Default behavior still
  // uploads source maps for our own code, which is what we actually
  // need for readable stack traces in Sentry.
  widenClientFileUpload: false,
  hideSourceMaps: true,
  disableLogger: true,
});
