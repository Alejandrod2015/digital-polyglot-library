/**
 * URL base para los enlaces que van DENTRO de un correo.
 *
 * POR QUÉ (2026-08-17). `APP_BASE_URL` vale `http://localhost:3000` en
 * `.env.local`, que es lo correcto para desarrollar, y los constructores de
 * correos leían esa variable a pelo. Al invitar a cuatro personas reales a la
 * beta desde una terminal local, el correo iba a salir con todos sus enlaces
 * apuntando a localhost: rotos para quien los recibe, y sin vuelta atrás una
 * vez enviados. Se pilló en el paso en seco, de casualidad.
 *
 * `scripts/betaPreflight.ts` ya avisaba de esto, pero es una comprobación
 * aparte que hay que acordarse de correr. Aquí no hay nada que recordar: un
 * host local nunca sale en un correo, porque la sustitución ocurre donde se
 * construye el enlace.
 *
 * Para trabajar en local se previsualiza (`--dry`, `_renderBetaEmails.ts`), que
 * es donde sí interesa ver el localhost.
 */
const PUBLICO = "https://digitalpolyglot.com";
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?/i;

let avisado = false;

/**
 * `preferida` gana, salvo que apunte a una máquina local.
 *
 * `publicoPorDefecto` es para los correos que NO viven en el dominio de la
 * web: los enlaces de canje apuntan al lector, y sustituir un localhost por
 * la web pública los rompería igual, solo que de forma menos visible.
 */
export function publicBaseUrl(preferida?: string | null, publicoPorDefecto: string = PUBLICO): string {
  const respaldo = LOCAL.test(publicoPorDefecto.trim()) ? PUBLICO : publicoPorDefecto.trim();
  const candidata = (preferida ?? process.env.APP_BASE_URL ?? respaldo).trim();
  if (!LOCAL.test(candidata)) return candidata.replace(/\/+$/, "");
  if (!avisado) {
    avisado = true;
    console.warn(
      `[email] APP_BASE_URL apunta a ${candidata}; los enlaces de los correos usarán ${respaldo}. ` +
        "Un host local en un correo enviado es un enlace roto para quien lo recibe.",
    );
  }
  return respaldo.replace(/\/+$/, "");
}
