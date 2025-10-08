import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async () => {
  // Header de diagnóstico para confirmar que SÍ corrió el middleware
  const res = NextResponse.next();
  res.headers.set("x-clerk-mw", "1");
  return res;
});

export const config = {
  matcher: [
    // proteger todo excepto archivos estáticos y Next internals
    "/((?!_next|.*\\..*).*)",
    "/",
    "/(api|trpc)(.*)",
  ],
};
