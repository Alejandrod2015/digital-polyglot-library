// middleware.ts
import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/books(.*)"], // rutas accesibles sin login
});

export const config = {
  matcher: [
    // Aplica Clerk en todas las rutas excepto archivos estáticos y API
    "/((?!_next|.*\\..*|api).*)",
  ],
};
