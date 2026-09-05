import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const WP_ORIGIN = process.env.WP_ORIGIN_HOST ?? "https://wp.digitalpolyglot.com";

// CARPETA DE COMPILACION POR SESION. Varios `next dev` sobre este mismo repo
// escriben todos en `.next` y se pisan los trozos de vendor entre ellos: el
// sintoma es "Cannot find module './vendor-chunks/@clerk.js'" y un 500 en
// cualquier pagina, con la compilacion recien borrada. Con NEXT_DIST_DIR cada
// servidor usa la suya y dejan de estorbarse. Sin la variable, todo sigue igual.
const nextConfig: NextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
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
      // 🖼️ Wikimedia Commons — photos for Talking Points. Freely licensed and
      // credited in the UI; see src/lib/wikimediaCommons.ts.
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/about-us", destination: "/", permanent: true },
      { source: "/about-us/", destination: "/", permanent: true },
      { source: "/careers", destination: "/", permanent: true },
      { source: "/careers/", destination: "/", permanent: true },
      // Consolidacion del cluster "spanish sayings" (2026-09-01): tres URLs
      // competian por la misma consulta y ninguna pasaba de la posicion 36.
      // El contenido util de estas dos se fusiono en el dicho superviviente.
      { source: "/blog/top-10-spanish-sayings", destination: "/blog/25-spanish-dichos-traditional-sayings-with-meanings", permanent: true },
      { source: "/blog/top-10-spanish-sayings/", destination: "/blog/25-spanish-dichos-traditional-sayings-with-meanings", permanent: true },
      { source: "/blog/key-sayings-you-need-to-speak-spanish-like-a-native", destination: "/blog/25-spanish-dichos-traditional-sayings-with-meanings", permanent: true },
      { source: "/blog/key-sayings-you-need-to-speak-spanish-like-a-native/", destination: "/blog/25-spanish-dichos-traditional-sayings-with-meanings", permanent: true },
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
