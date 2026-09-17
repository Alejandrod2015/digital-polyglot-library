/**
 * Un solo enlace para los correos: `/go/app`. Decide a donde va segun el
 * dispositivo DESDE EL QUE SE ABRE el correo, que es lo unico que importa
 * cuando alguien lee en el movil el correo que le llego al portatil.
 *
 *   iPhone o iPad -> abre la app; si no esta instalada, TestFlight
 *   Android       -> abre la app; si no esta instalada, Google Play
 *   escritorio    -> una pagina que dice "abrelo desde el movil" con los dos
 *                    enlaces de instalacion. NUNCA el lector web: la beta
 *                    existe para probar las apps, y cuando esta ruta mandaba
 *                    al lector web en escritorio casi nadie llegaba a
 *                    instalarlas (2026-09-17).
 *
 * En movil NO se puede hacer un 302 al esquema propio (`digitalpolyglot://`):
 * Safari y Chrome lo rechazan como respuesta de navegacion. Se devuelve una
 * pagina minima que lo intenta y deja a la vista el enlace de instalar, SIN
 * redirigir sola: el dialogo de confirmacion de iOS deja
 * la pagina visible mientras el usuario decide, asi que un temporizador acaba
 * mandando a la App Store a quien ya tiene la app.
 *
 * Lo definitivo es un Universal Link (iOS) y un App Link (Android): abren la
 * app sin dialogo y sin pantalla intermedia, pero exigen publicar
 * .well-known/apple-app-site-association y assetlinks.json Y un build nuevo de
 * cada app que declare el dominio.
 *
 * `?to=` viaja hasta la app para poder enlazar un journey concreto mas
 * adelante; hoy nadie lo usa y el valor por defecto es la raiz.
 */
import { NextResponse } from "next/server";
import { playOptInUrl } from "@/lib/googlePlayBeta";

export const dynamic = "force-dynamic";

/**
 * El enlace publico de TestFlight vive en env (el mismo que usa el correo de
 * aceptacion). Sin el, la ficha de TestFlight en la App Store, que es a donde
 * ya mandaba `beta.ts`: no se inventa una URL de invitacion.
 */
function iosFallback(): string {
  return (
    process.env.TESTFLIGHT_PUBLIC_URL?.trim() ||
    "https://apps.apple.com/app/testflight/id899247664"
  );
}

/** La pagina de tester de Play, o su ficha si la beta no esta configurada. */
function androidFallback(): string {
  return playOptInUrl() ?? "https://play.google.com/store/apps/details?id=com.digitalpolyglot.app";
}

/** Solo lo que hace falta para repartir: iOS, Android o cualquier otra cosa. */
function deviceOf(ua: string): "ios" | "android" | "desktop" {
  const s = ua.toLowerCase();
  if (/android/.test(s)) return "android";
  // iPadOS 13+ se anuncia como Macintosh y solo se delata por el touch, que
  // aqui no se puede mirar; el iPad con "Macintosh" cae en escritorio y abre
  // el lector web, que en un iPad funciona igual de bien.
  if (/iphone|ipad|ipod/.test(s)) return "ios";
  return "desktop";
}

const esc = (s: string) => s.replace(/"/g, "&quot;");

/** El mismo marco oscuro para las dos paginas: puente en movil, aviso en escritorio. */
function shell(title: string, body: string, script = ""): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>${title}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#051834; color:#c2d2e8; font:600 16px/1.6 -apple-system,system-ui,sans-serif; text-align:center; padding:28px; }
  h1 { font-size:19px; color:#eef4fc; margin:0 0 6px; }
  p { margin:0 0 22px; font-size:14.5px; color:#8aa0be; }
  a.btn { display:block; max-width:320px; margin:0 auto 12px; padding:15px 22px; border-radius:14px;
    background:#fcd34d; color:#000; font-weight:800; text-decoration:none; }
  a.btn.quiet { background:rgba(255,255,255,0.08); color:#eef4fc; }
  a.alt { color:#7dd3fc; font-size:14px; }
  small { display:block; margin-top:18px; font-size:12.5px; color:#5f748f; }
</style>
</head><body>
<div>
${body}
</div>
${script}
</body></html>`;
}

/** Movil: intenta abrir la app y deja a la vista el enlace de instalacion. */
function bridge(deepLink: string, storeUrl: string): string {
  return shell(
    "Opening Digital Polyglot",
    `<h1>Opening the app…</h1>
  <p>If nothing happens, the app may not be installed on this device.</p>
  <a class="btn" href="${esc(deepLink)}">Open the app</a>
  <p style="margin-top:16px;"><a class="alt" href="${esc(storeUrl)}">Install it</a></p>`,
    `<script>
  // Se INTENTA abrir la app, pero NO se redirige sola a la tienda. El dialogo
  // de confirmacion de iOS ("¿Abrir en...?") deja la pagina visible mientras
  // el usuario decide, asi que cualquier temporizador se dispara antes de
  // tiempo y lo saca a la App Store teniendo la app instalada (visto en un
  // iPhone el 2026-08-28). Con el enlace a la vista, decide la persona.
  window.location.href = ${JSON.stringify(deepLink)};
</script>`,
  );
}

/**
 * Escritorio: la beta es de las apps, asi que aqui no hay lector web. Se
 * explica que hay que abrir el enlace en el telefono y se dejan los dos
 * enlaces de instalacion (el de TestFlight y el de alta en Play) para quien
 * prefiera copiarlos.
 */
function desktop(iosUrl: string, androidUrl: string): string {
  return shell(
    "Digital Polyglot is a phone app",
    `<h1>The beta lives on your phone</h1>
  <p>Open this same link on your iPhone or Android to install the app.<br/>
  Or use one of these on your phone:</p>
  <a class="btn" href="${esc(iosUrl)}">iPhone · TestFlight</a>
  <a class="btn quiet" href="${esc(androidUrl)}">Android · Google Play beta</a>
  <small>Questions? support@digitalpolyglot.com</small>`,
  );
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const to = url.searchParams.get("to") ?? "";
  const deepLink = `digitalpolyglot://${to.replace(/^\/+/, "")}`;
  const device = deviceOf(request.headers.get("user-agent") ?? "");

  const html =
    device === "desktop"
      ? desktop(iosFallback(), androidFallback())
      : bridge(deepLink, device === "android" ? androidFallback() : iosFallback());
  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
