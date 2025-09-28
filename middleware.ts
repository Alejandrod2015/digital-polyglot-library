import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: [
    '/',         // Página pública
    '/books',    // Lista de libros
    '/sign-in',  // Inicio de sesión
    '/sign-up',  // Registro
  ],
});

export const config = {
  matcher: [
    /*
     * Protege todas las rutas excepto las públicas
     */
    '/((?!api|_next|.*\\..*).*)',
  ],
};
