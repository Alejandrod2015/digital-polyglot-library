import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const WP_ORIGIN = process.env.WP_ORIGIN_HOST ?? "https://wp.digitalpolyglot.com";
// Toggle the blog backend. Default is the local MDX routes under
// app/blog/*. Setting BLOG_BACKEND=wp falls back to the legacy WordPress
// proxy (kept as an escape hatch while we confirm the cutover).
const BLOG_BACKEND = process.env.BLOG_BACKEND ?? "mdx";

// Path prefixes that still live on the WordPress origin and must be
// reverse-proxied so the change to the apex A record (now → Vercel) doesn't
// 404 them. Order doesn't matter; matching is prefix-based with a slash
// boundary so e.g. /shop matches /shop and /shop/foo but not /shopping-cart.
const WP_PROXY_PREFIXES = [
  "/cart",
  "/checkout",
  "/shop",
  "/my-account",
  "/product",
  "/product-category",
  "/feed",
  "/comments",
  "/contact",
  "/free-e-book",
  "/e-books",
  "/podcasts",
  "/members",
  "/wp-admin",
];

function isWordPressPath(pathname: string): boolean {
  return WP_PROXY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// WordPress renders absolute asset URLs (notably WooCommerce `srcset`
// candidates) as http://www.digitalpolyglot.com/wp-content/... Behind the
// https-only Vercel apex the browser picks the matching srcset candidate over
// the https `src` and blocks it as mixed content, so every product image on
// /shop, /product, etc. renders broken. This CSP directive transparently
// upgrades those http subresource requests to https — the https variants are
// already served (200), so it's a page-wide, zero-cost fix that doesn't
// restrict any sources.
function proxyToWordPress(req: { nextUrl: { search: string } }, upstreamPath: string): NextResponse {
  const res = NextResponse.rewrite(new URL(upstreamPath + req.nextUrl.search, WP_ORIGIN));
  res.headers.set("Content-Security-Policy", "upgrade-insecure-requests");
  return res;
}

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl.pathname;
  const host = req.headers.get("host")?.toLowerCase() ?? "";
  const isProd = process.env.NODE_ENV === "production";

  if (host === "beta.digitalpolyglot.com") {
    return NextResponse.redirect("https://digitalpolyglot.com/beta", 308);
  }

  // Blog: transparent proxy to the WordPress origin while BLOG_BACKEND !== mdx.
  // Done in middleware so we can keep the trailing slash on the upstream
  // request — otherwise WP issues a 301 to wp.digitalpolyglot.com/.../,
  // leaking the internal host into the user's URL bar. We accept both
  // /blog/foo and /blog/foo/ as canonical. When BLOG_BACKEND === "mdx",
  // the request falls through to the Next.js routes in app/blog/*.
  if (BLOG_BACKEND !== "mdx" && (url === "/blog" || url.startsWith("/blog/"))) {
    const upstreamPath = url.endsWith("/") ? url : `${url}/`;
    return proxyToWordPress(req, upstreamPath);
  }

  // WordPress-served legacy paths (WooCommerce checkout, RSS feed, WP admin,
  // and a handful of pages that still live on the WP origin). Proxied here so
  // the user keeps seeing www.digitalpolyglot.com in the URL bar; otherwise
  // the change to the apex A record would 404 them on Vercel.
  if (isWordPressPath(url)) {
    const upstreamPath = url.endsWith("/") ? url : `${url}/`;
    return proxyToWordPress(req, upstreamPath);
  }

  // Legacy WooCommerce webhook endpoints use the root path with a wc-api or
  // wc-ajax query parameter (Stripe Classic, PayPal Standard, refresh-cart
  // fragments, etc.). After the apex moved to Vercel the home page would
  // swallow these as 200 OK without ever running the WC handler, silently
  // dropping every payment webhook. Forward them to WP intact.
  if (
    url === "/" &&
    (req.nextUrl.searchParams.has("wc-api") ||
      req.nextUrl.searchParams.has("wc-ajax"))
  ) {
    return NextResponse.rewrite(new URL(`/${req.nextUrl.search}`, WP_ORIGIN));
  }

  // Mobile API routes use the app's own signed mobile session token, not Clerk's
  // session JWT header/cookie flow. Let them pass through untouched.
  if (url.startsWith("/api/mobile/")) {
    return NextResponse.next();
  }

  if (isProd && url.startsWith("/studio/metrics")) {
    const { userId } = await auth();
    if (userId) {
      return NextResponse.next();
    }

    // Bypass for admin direct-link sharing via `?key=...` or `x-metrics-key`
    // header. Lets ops dashboards (e.g. uptime checks) hit the panel without
    // a Clerk session, gated by the server-side METRICS_DASHBOARD_KEY env.
    const expectedKey = process.env.METRICS_DASHBOARD_KEY?.trim();
    const providedKey =
      req.headers.get("x-metrics-key")?.trim() ?? req.nextUrl.searchParams.get("key")?.trim();

    if (expectedKey && providedKey && providedKey === expectedKey) {
      return NextResponse.next();
    }

    // Signed-out + no key: send to home rather than a bare 404. The admin
    // route still doesn't advertise itself in the nav for non-authenticated
    // users, so this isn't a discoverability leak.
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!.+\\.[\\w]+$|_next).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
