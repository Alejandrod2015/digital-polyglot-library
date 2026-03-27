import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl.pathname;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && url.startsWith("/studio/metrics")) {
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
