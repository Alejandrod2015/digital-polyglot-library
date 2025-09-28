// middleware.ts
import { withClerkMiddleware } from '@clerk/nextjs/server';

export default withClerkMiddleware();

export const config = {
  matcher: [
    // Habilita Clerk para todas las rutas excepto archivos estáticos y API
    '/((?!_next|.*\\..*|api).*)',
  ],
};
