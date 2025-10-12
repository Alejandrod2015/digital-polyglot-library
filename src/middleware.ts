import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, req) => {
  // ⚡ Excluir Clerk para la ruta /api/favorites
  const url = req.nextUrl.pathname;
  if (url.startsWith("/api/favorites")) {
    return NextResponse.next(); // No aplicar Clerk
  }

  // Header de diagnóstico para confirmar que SÍ corrió el middleware
  const res = NextResponse.next();
  res.headers.set("x-clerk-mw", "1");
  return res;
});

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/",
    "/(api|trpc)(.*)", // ✅ mantenemos esta
  ],
};
