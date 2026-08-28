/**
 * Universal Links de iOS. Con esto, un enlace https a este dominio abre la app
 * DIRECTAMENTE: sin el dialogo "¿Abrir en...?" que sale con el esquema propio
 * y sin pantalla intermedia. Si la app no esta instalada, el mismo enlace
 * carga la web, que es justo el comportamiento que se busca en `/go/app`.
 *
 * `APPLE_TEAM_ID` es el `seedId` de los bundle ids en App Store Connect
 * (JJSDKZ9AN7; se saca con `npx tsx scripts/_appleTeamId.ts`). Sin esa
 * variable la ruta devuelve 404, que es mejor que servir un JSON invalido:
 * iOS cachea el fichero y un contenido malo tarda dias en corregirse.
 *
 * `apps/mobile/app.config.js` ya declara los `associatedDomains`, pero iOS
 * SOLO lee este fichero al instalar la app: hasta que no salga un build nuevo,
 * el enlace sigue abriendo el navegador.
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
