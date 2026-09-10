/**
 * Comprueba TODOS los enlaces y todas las imagenes de los correos contra
 * produccion. Existe porque el 2026-08-26 un CTA de un correo apuntaba a
 * /stories, que nunca ha tenido indice: 404 para todo el que lo pulsara.
 *
 *   npx tsx scripts/checkEmailLinks.ts
 *
 * Renderiza cada correo con las URLs de PRODUCCION (no las de la
 * previsualizacion), saca cada href y cada src, y pide cada uno. Sale con
 * codigo 1 si algo no responde 200, para poder colgarlo de un hook.
 *
 * Los enlaces con token (unsubscribe, feedback) se piden igual: el token de
 * ejemplo es invalido, asi que lo que se comprueba es que la RUTA existe, no
 * que el token valga. Un 4xx que no sea 404 en esas rutas se marca aparte.
 */
import { existsSync } from "node:fs";
import { BETA_EMAIL_BUILDERS, type BetaEmailKind, type BetaEmailData } from "../src/lib/emails/beta";
import { LIFECYCLE_BUILDERS, type LifecycleKind } from "../src/lib/emails/lifecycle";

const BASE = process.env.CHECK_BASE ?? "https://digitalpolyglot.com";
const ASSETS = process.env.CHECK_ASSETS ?? "https://reader.digitalpolyglot.com";

const common: BetaEmailData = {
  baseUrl: BASE,
  assetBase: ASSETS,
  firstName: "Marta",
  targetLanguage: "Spanish",
  feedbackUrl: `${BASE}/beta/feedback?token=demo&kind=bug`,
  reviewUrl: "https://apps.apple.com/app/id6760942737?action=write-review",
  testflightUrl: "https://testflight.apple.com/join/example",
  playOptInUrl: "https://play.google.com/apps/testing/com.digitalpolyglot.app",
  playGroupJoinUrl: "https://groups.google.com/g/dpl-android-beta",
};

const CASES: Array<{ kind: BetaEmailKind; data: BetaEmailData }> = [
  { kind: "accepted", data: common },
  { kind: "accepted_android", data: { ...common, platform: "android" } },
  { kind: "waitlist", data: common },
  { kind: "declined", data: common },
  { kind: "install_nudge", data: common },
  { kind: "install_nudge", data: { ...common, platform: "android" } },
  { kind: "feedback_ask", data: common },
  { kind: "stuck_ask", data: common },
  { kind: "mid_survey", data: common },
  { kind: "final_survey", data: common },
  { kind: "review_ask", data: common },
  { kind: "review_recover", data: common },
  {
    kind: "release_note",
    data: {
      ...common,
      release: { version: "1.0", buildNumber: "280", headline: "Test", whatsNew: ["x"] },
    },
  },
  {
    kind: "improvement",
    data: {
      ...common,
      improvement: {
        changes: ["x"],
        example: {
          word: "baja",
          caption: "x",
          image: "/email/glosses/baja-tap.gif",
          fullSizeImage: "/email/glosses/baja-after.png",
        },
        askThem: "x",
        ctaUrl: `${BASE}/explore`,
      },
    },
  },
  // Sin `feedbackUrl` ni `ctaUrl`: asi se ven los valores por defecto, que es
  // justo donde se escondian los 404.
  { kind: "feedback_ask", data: { ...common, feedbackUrl: undefined } },
  { kind: "stuck_ask", data: { ...common, feedbackUrl: undefined } },
  { kind: "mid_survey", data: { ...common, feedbackUrl: undefined } },
  { kind: "final_survey", data: { ...common, feedbackUrl: undefined } },
  { kind: "review_recover", data: { ...common, feedbackUrl: undefined } },
  {
    kind: "improvement",
    data: { ...common, improvement: { changes: ["x"] } },
  },
];

/**
 * Los NUEVE correos del ciclo de vida, renderizados SIN datos de usuario, que
 * es como salen cuando el remitente no tiene nada que pasarles.
 *
 * WHY (2026-09-07): este script solo miraba los correos de la beta. El de
 * bienvenida, que es del ciclo de vida, nunca se comprobo, y llevaba desde
 * agosto mandando a 23 personas a una historia sin publicar. Cubrir un
 * remitente y no el otro es no cubrir nada: la rama sin datos es justo donde
 * viven los enlaces por defecto.
 */
const LIFECYCLE_CASES: LifecycleKind[] = [
  "welcome",
  "nudge",
  "celebration",
  "recap",
  "next",
  "winReminder",
  "winValue",
  "winSunset",
];

function urlsOf(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (url.startsWith("http")) found.add(url);
  }
  return [...found];
}

/**
 * Un 404 de Next dentro de una respuesta 200.
 *
 * WHY (2026-09-07): una ruta de app router que llama a `notFound()` puede
 * contestar 200 y pintar la pantalla "404: This page could not be found" en el
 * cuerpo. Este script solo miraba `res.status`, asi que
 * `/stories/mole-en-san-angel` le salio EN VERDE durante cuatro semanas
 * mientras el boton de la bienvenida moria en esa pantalla. Un 200 no
 * demuestra que la pagina exista; hay que mirar lo que trae.
 */
// OJO con el patron: la frase "404: This page could not be found" viaja en el
// payload RSC de TODAS las paginas, porque es la plantilla `notFound` que
// registra el layout raiz. Buscarla marcaba en rojo hasta la portada. El unico
// marcador que aparece solo cuando la ruta ha llamado de verdad a `notFound()`
// es el digest del error.
const NEXT_404 = /NEXT_HTTP_ERROR_FALLBACK;404/;

async function status(url: string): Promise<number> {
  try {
    // Apple y Google responden 403/404 a un fetch sin navegador detras.
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      },
    });
    if (res.status === 200 && (res.headers.get("content-type") ?? "").includes("text/html")) {
      const body = await res.text();
      if (NEXT_404.test(body)) return 404;
    }
    return res.status;
  } catch {
    return 0;
  }
}

/**
 * Un 404 no siempre es un fallo del correo:
 *  - un asset que existe en `public/` todavia no esta desplegado;
 *  - la ficha de la App Store no existe hasta que la app se publique;
 *  - los enlaces de ejemplo de este script (TestFlight) no son reales.
 * Lo que NO tiene excusa es una ruta de la web que no existe.
 */
function excuse(url: string): string | null {
  // Una ruta que YA existe en el repo pero todavia no se ha desplegado: es
  // pendiente, no rota. Lo que se busca aqui son URLs que no existen en
  // ninguna parte, como el viejo /stories.
  if (url.startsWith(BASE)) {
    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    if (path && ["route.ts", "route.tsx", "page.tsx"].some((f) => existsSync(`src/app/${path}/${f}`))) {
      return "sin desplegar (la ruta existe en src/app/)";
    }
  }
  if (url.startsWith(ASSETS)) {
    const path = url.slice(ASSETS.length);
    if (existsSync(`public${path}`)) return "sin desplegar (existe en public/)";
  }
  if (url.includes("apps.apple.com")) return "la app no esta publicada todavia";
  if (url.includes("testflight.apple.com/join/example")) return "enlace de ejemplo de este script";
  return null;
}

async function main() {
  const byUrl = new Map<string, Set<string>>();
  const note = (url: string, kind: string) => {
    if (!byUrl.has(url)) byUrl.set(url, new Set());
    byUrl.get(url)!.add(kind);
  };

  for (const c of CASES) {
    const { html } = BETA_EMAIL_BUILDERS[c.kind](c.data);
    for (const url of urlsOf(html)) note(url, c.kind);
  }

  for (const kind of LIFECYCLE_CASES) {
    const { html } = LIFECYCLE_BUILDERS[kind]({ baseUrl: BASE, assetBase: ASSETS });
    for (const url of urlsOf(html)) note(url, `lifecycle:${kind}`);
  }

  const rows = await Promise.all(
    [...byUrl.entries()].map(async ([url, kinds]) => ({
      url,
      kinds: [...kinds].join(", "),
      code: await status(url),
    })),
  );

  rows.sort((a, b) => a.code - b.code || a.url.localeCompare(b.url));

  // Sin red, TODA peticion devuelve 0 y esto marcaria los veinte enlaces como
  // rotos. Cuelga del pre-push, asi que un push desde un tren no puede
  // convertirse en veinte falsos positivos: si no respondio ni uno, el que
  // esta caido es el enlace de red, no el correo. Que fallen ALGUNOS si
  // bloquea, que es el caso que importa.
  if (rows.length && rows.every((r) => r.code === 0)) {
    console.log(`\nSIN RED: ninguno de los ${rows.length} enlaces respondio. No se comprueba nada.`);
    return;
  }

  const bad = rows.filter((r) => r.code !== 200 && !excuse(r.url));
  const waiting = rows.filter((r) => r.code !== 200 && excuse(r.url));

  for (const r of rows) {
    const why = r.code === 200 ? null : excuse(r.url);
    const mark = r.code === 200 ? "ok  " : why ? "wait" : "FAIL";
    const tail = why ? `   (${why})` : "";
    console.log(`${mark} ${String(r.code).padEnd(3)} ${r.url}   [${r.kinds}]${tail}`);
  }
  console.log(`\n${rows.length} enlaces, ${bad.length} rotos, ${waiting.length} pendientes.`);
  if (bad.length) process.exitCode = 1;
}

main();
