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
// boundary so e.g. /feed matches /feed and /feed/foo but not /feedback.
//
// NOTE: the WooCommerce *store* surface (/shop, /product, /product-category,
// /cart, /checkout, /my-account) is intentionally NOT here; it moved to
// Shopify and is 308-redirected instead (see shopifyRedirectFor). The old WP
// store rendered broken product images, an orphaned cart, and a 404 on
// /my-account, so proxying it only kept dead pages alive.
const WP_PROXY_PREFIXES = [
  "/feed",
  "/comments",
  "/contact",
  "/free-e-book",
  "/e-books",
  "/podcasts",
  "/members",
  "/wp-admin",
];

function matchesPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isWordPressPath(pathname: string): boolean {
  return WP_PROXY_PREFIXES.some((p) => matchesPath(pathname, p));
}

const SHOPIFY_ORIGIN =
  process.env.SHOPIFY_STORE_URL ?? "https://shop.digitalpolyglot.com";

// Map a legacy WooCommerce store path to its live Shopify equivalent, or null
// if the path isn't part of the migrated store. The WP store is dead (broken
// images, non-functional cart) while the site menu already links to Shopify;
// these redirects make stray direct hits, old bookmarks, and search-engine
// results land on the working store instead of an error or a broken page.
function shopifyRedirectFor(pathname: string): string | null {
  // Freebies category → Shopify "Free Resources" collection.
  if (matchesPath(pathname, "/product-category/free")) {
    return `${SHOPIFY_ORIGIN}/collections/freebies`;
  }
  // Any other product category → full catalogue (WooCommerce slugs don't
  // reliably map 1:1 onto Shopify collection handles).
  if (matchesPath(pathname, "/product-category")) {
    return `${SHOPIFY_ORIGIN}/collections/all`;
  }
  // Individual products → store home (slugs differ between the two platforms).
  if (matchesPath(pathname, "/product")) {
    return `${SHOPIFY_ORIGIN}/`;
  }
  // Cart and checkout (incl. /shop/?add-to-cart actions caught by /shop below)
  // → Shopify cart.
  if (matchesPath(pathname, "/cart") || matchesPath(pathname, "/checkout")) {
    return `${SHOPIFY_ORIGIN}/cart`;
  }
  // Customer account → Shopify account.
  if (matchesPath(pathname, "/my-account")) {
    return `${SHOPIFY_ORIGIN}/account`;
  }
  // Shop listing and every /shop/* (pagination, add-to-cart, feed) → store home.
  if (matchesPath(pathname, "/shop")) {
    return `${SHOPIFY_ORIGIN}/`;
  }
  return null;
}

// WordPress renders absolute asset URLs (notably image `srcset` candidates) as
// http://www.digitalpolyglot.com/wp-content/... Behind the https-only Vercel
// apex the browser picks the matching http srcset candidate over the https
// `src` and blocks it as mixed content, breaking images on the proxied pages.
// This CSP directive transparently upgrades those http subresource requests to
// https (the https variants are already served), without restricting any
// sources.
function proxyToWordPress(search: string, upstreamPath: string): NextResponse {
  const res = NextResponse.rewrite(
    new URL(upstreamPath + search, WP_ORIGIN),
  );
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
  // request; otherwise WP issues a 301 to wp.digitalpolyglot.com/.../,
  // leaking the internal host into the user's URL bar. We accept both
  // /blog/foo and /blog/foo/ as canonical. When BLOG_BACKEND === "mdx",
  // the request falls through to the Next.js routes in app/blog/*.
  if (BLOG_BACKEND !== "mdx" && (url === "/blog" || url.startsWith("/blog/"))) {
    const upstreamPath = url.endsWith("/") ? url : `${url}/`;
    return proxyToWordPress(req.nextUrl.search, upstreamPath);
  }

  // Legacy WooCommerce store paths → live Shopify store. Checked before the WP
  // proxy so the dead store pages (broken images, orphan cart, /my-account 404)
  // never render; old links and search results land on the working store.
  const shopifyTarget = shopifyRedirectFor(url);
  if (shopifyTarget) {
    return NextResponse.redirect(shopifyTarget, 308);
  }

  // WordPress-served legacy paths (RSS feed, WP admin, and a handful of content
  // pages that still live on the WP origin). Proxied here so the user keeps
  // seeing www.digitalpolyglot.com in the URL bar; otherwise the change to the
  // apex A record would 404 them on Vercel.
  if (isWordPressPath(url)) {
    const upstreamPath = url.endsWith("/") ? url : `${url}/`;
    return proxyToWordPress(req.nextUrl.search, upstreamPath);
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
