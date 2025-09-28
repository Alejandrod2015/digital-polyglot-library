// middleware.ts
import { WithClerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    // Habilita Clerk para todas las rutas excepto archivos estáticos y API
    '/((?!_next|.*\\..*|api).*)',
  ],
};
function clerkMiddleware() {
  throw new Error('Function not implemented.');
}

