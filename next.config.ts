import type { NextConfig } from "next";

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
  async rewrites() {
    return [
      { source: "/wp-content/:path*", destination: `${WP_ORIGIN}/wp-content/:path*` },
      { source: "/wp-includes/:path*", destination: `${WP_ORIGIN}/wp-includes/:path*` },
      { source: "/wp-json/:path*", destination: `${WP_ORIGIN}/wp-json/:path*` },
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
};

export default nextConfig;
