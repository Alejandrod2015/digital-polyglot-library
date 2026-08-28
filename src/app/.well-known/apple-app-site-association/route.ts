/**
 * Universal Links de iOS. Con esto, un enlace https a este dominio abre la app
 * DIRECTAMENTE: sin el dialogo "¿Abrir en...?" que sale con el esquema propio
 * y sin pantalla intermedia. Si la app no esta instalada, el mismo enlace
 * carga la web, que es justo el comportamiento que se busca en `/go/app`.
 *
 * Faltan dos piezas ademas de este fichero, y las dos son del usuario:
 *   1. `APPLE_TEAM_ID` en el entorno (Membership de developer.apple.com). Sin
 *      ella esta ruta devuelve 404, que es mejor que servir un JSON invalido:
 *      iOS cachea el fichero y un contenido malo tarda dias en corregirse.
 *   2. Un BUILD NUEVO de la app declarando `associatedDomains:
 *      ["applinks:digitalpolyglot.com", "applinks:www.digitalpolyglot.com"]`
 *      en `apps/mobile/app.json`.
 *
 * El fichero se sirve SIN extension y como `application/json`, que es como
 * Apple lo pide.
 */
export const dynamic = "force-dynamic";

const BUNDLE_ID = "com.digitalpolyglot.mobile";

export async function GET(): Promise<Response> {
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  if (!teamId) {
    return new Response("APPLE_TEAM_ID no configurado", { status: 404 });
  }

  const body = {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${BUNDLE_ID}`],
          // Solo las rutas que la app sabe abrir. `/go/app` es el enlace de
          // los correos; el resto del sitio sigue siendo web.
          components: [{ "/": "/go/app*", comment: "el enlace de los correos" }],
        },
      ],
    },
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      // Apple lo relee cada pocos dias; un cache corto permite corregir sin
      // esperar a que caduque.
      "cache-control": "public, max-age=3600",
    },
  });
}
