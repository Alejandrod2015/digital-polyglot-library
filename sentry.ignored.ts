// Errores que Sentry NO debe registrar, compartidos por los tres runtimes.
//
// "Server Action ... was not found on the server" (UnrecognizedActionError):
// lo lanza Next cuando una pestaña abierta con el bundle anterior invoca una
// server action cuyo id ya no existe tras un deploy. Las server actions de
// esta app no son nuestras, son las que trae `@clerk/nextjs` para sincronizar
// la sesion; `src/` no declara ningun "use server". Es la ventana entre el
// deploy y la recarga del navegador, se resuelve sola y no hay nada que
// arreglar en el codigo. En la semana del 29/08 al 05/09 fueron 21 de los 32
// errores del proyecto: mas ruido que señal.
export const IGNORED_ERRORS: (string | RegExp)[] = [
  /Server Action "[^"]*" was not found on the server/,
  "UnrecognizedActionError",
];
