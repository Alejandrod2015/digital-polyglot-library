// Vitest alias para `server-only`: el paquete real TIRA al importarse fuera de
// un React Server Component, asi que un test que toque cualquier modulo del
// servidor (prisma, y con el todo el motor de la beta) no llega ni a arrancar.
export {};
