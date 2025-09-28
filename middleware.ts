import { WithClerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    /*
     * Protecting all routes except static files and Next.js internals
     */
    '/((?!.*\\..*|_next|api).*)',
    '/',
  ],
};
function clerkMiddleware() {
  throw new Error('Function not implemented.');
}

