import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const WP_ORIGIN = process.env.WP_ORIGIN_HOST ?? "https://wp.digitalpolyglot.com";
// Toggle the blog backend. When BLOG_BACKEND === "mdx" the local Next.js
// routes under /blog handle the requests directly. Anything else (including
// unset) keeps the legacy WP proxy. Default stays on WP until cutover.
const BLOG_BACKEND = process.env.BLOG_BACKEND ?? "wp";

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
    return NextResponse.rewrite(
      new URL(upstreamPath + req.nextUrl.search, WP_ORIGIN),
    );
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

    const expectedKey = process.env.METRICS_DASHBOARD_KEY?.trim();
    const providedKey =
      req.headers.get("x-metrics-key")?.trim() ?? req.nextUrl.searchParams.get("key")?.trim();

    if (!expectedKey || !providedKey || providedKey !== expectedKey) {
      return new NextResponse("Not Found", { status: 404 });
    }
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
