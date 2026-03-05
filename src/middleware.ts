import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl.pathname;

  // ⚡ Excluir solo rutas que deben ejecutarse sin Clerk
  // Mantener Stripe Checkout autenticado (necesita userId)
  if (url.startsWith("/api/favorites") || url.startsWith("/api/claims")) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", url);
  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  res.headers.set("x-clerk-mw", "1");
  return res;
});

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/",
    "/(api|trpc)(.*)", // ✅ mantener esta
  ],
};
