import {withSentryConfig} from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "digital-polyglot",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Automatically tree-shake Sentry logger statements to reduce bundle size
    treeshake: { removeDebugLogging: true },
    // Enables automatic instrumentation of Vercel Cron Monitors.
    automaticVercelMonitors: true,
  },
});
