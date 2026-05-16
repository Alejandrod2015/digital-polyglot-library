import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

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
};

export default withSentryConfig(nextConfig, {
  org: "digital-polyglot",
  project: "digital-polyglot",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
});
