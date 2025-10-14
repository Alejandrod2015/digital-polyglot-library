import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl.pathname;

  // ⚡ Excluir solo rutas que deben ejecutarse sin Clerk
  // Mantener Stripe Checkout autenticado (necesita userId)
  if (url.startsWith("/api/favorites")) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
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
