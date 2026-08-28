/**
 * Un solo enlace para los correos: `/go/app`. Decide a donde va segun el
 * dispositivo DESDE EL QUE SE ABRE el correo, que es lo unico que importa
 * cuando alguien lee en el movil el correo que le llego al portatil.
 *
 *   iPhone o iPad -> abre la app; si no esta instalada, TestFlight
 *   Android       -> abre la app; si no esta instalada, Google Play
 *   escritorio    -> el lector web
 *
 * En movil NO se puede hacer un 302 al esquema propio (`digitalpolyglot://`):
 * Safari y Chrome lo rechazan como respuesta de navegacion. Se devuelve una
 * pagina minima que intenta abrirlo y, si a los 1,2 s el navegador sigue
 * visible (es decir, la app no se abrio), manda a la tienda.
 *
 * `?to=` viaja hasta la app para poder enlazar un journey concreto mas
 * adelante; hoy nadie lo usa y el valor por defecto es la raiz.
 */
import { NextResponse } from "next/server";
import { publicBaseUrl } from "@/lib/emails/publicBaseUrl";
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

function bridge(deepLink: string, storeUrl: string, webUrl: string): string {
  const esc = (s: string) => s.replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Opening Digital Polyglot</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#051834; color:#c2d2e8; font:600 16px/1.5 -apple-system,system-ui,sans-serif; text-align:center; padding:24px; }
  a { color:#7dd3fc; }
</style>
</head><body>
<div>
  <p>Opening the app…</p>
  <p style="font-size:14px;">Nothing happened? <a href="${esc(storeUrl)}">Install it</a> or <a href="${esc(webUrl)}">read on the web</a>.</p>
</div>
<script>
  (function () {
    var hidden = false;
    document.addEventListener("visibilitychange", function () { if (document.hidden) hidden = true; });
    window.addEventListener("pagehide", function () { hidden = true; });
    window.location.href = ${JSON.stringify(deepLink)};
    setTimeout(function () { if (!hidden) window.location.replace(${JSON.stringify(storeUrl)}); }, 1200);
  })();
</script>
</body></html>`;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const to = url.searchParams.get("to") ?? "";
  const base = publicBaseUrl();
  const webUrl = `${base}/explore`;
  const deepLink = `digitalpolyglot://${to.replace(/^\/+/, "")}`;
  const device = deviceOf(request.headers.get("user-agent") ?? "");

  if (device === "desktop") return NextResponse.redirect(webUrl, 302);

  const storeUrl = device === "android" ? androidFallback() : iosFallback();
  return new NextResponse(bridge(deepLink, storeUrl, webUrl), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
