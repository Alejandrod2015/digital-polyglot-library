import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const WP_ORIGIN = process.env.WP_ORIGIN_HOST ?? "https://wp.digitalpolyglot.com";

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl.pathname;
  const host = req.headers.get("host")?.toLowerCase() ?? "";
  const isProd = process.env.NODE_ENV === "production";

  if (host === "beta.digitalpolyglot.com") {
    return NextResponse.redirect("https://digitalpolyglot.com/beta", 308);
  }

  // Blog: transparent proxy to the WordPress origin. Done in middleware so we
  // can keep the trailing slash on the upstream request — otherwise WP issues
  // a 301 to wp.digitalpolyglot.com/.../, leaking the internal host into the
  // user's URL bar. We accept both /blog/foo and /blog/foo/ as canonical.
  if (url === "/blog" || url.startsWith("/blog/")) {
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
