// middleware.ts
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/books(.*)", "/sign-in(.*)", "/sign-up(.*)"],
});

export const config = {
  matcher: [
    // Aplica Clerk a todas las rutas menos estáticos y API
    "/((?!_next|.*\\..*|api).*)",
  ],
};
