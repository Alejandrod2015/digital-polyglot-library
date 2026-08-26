/**
 * Comprueba TODOS los enlaces y todas las imagenes de los correos contra
 * produccion. Existe porque el 2026-08-26 un CTA de un correo apuntaba a
 * /stories, que nunca ha tenido indice: 404 para todo el que lo pulsara.
 *
 *   npx tsx scripts/_checkEmailLinks.ts
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
  { kind: "feedback_ask", data: common },
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
  { kind: "mid_survey", data: { ...common, feedbackUrl: undefined } },
  { kind: "final_survey", data: { ...common, feedbackUrl: undefined } },
  { kind: "review_recover", data: { ...common, feedbackUrl: undefined } },
  {
    kind: "improvement",
    data: { ...common, improvement: { changes: ["x"] } },
  },
];

function urlsOf(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (url.startsWith("http")) found.add(url);
  }
  return [...found];
}

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
  for (const c of CASES) {
    const { html } = BETA_EMAIL_BUILDERS[c.kind](c.data);
    for (const url of urlsOf(html)) {
      if (!byUrl.has(url)) byUrl.set(url, new Set());
      byUrl.get(url)!.add(c.kind);
    }
  }

  const rows = await Promise.all(
    [...byUrl.entries()].map(async ([url, kinds]) => ({
      url,
      kinds: [...kinds].join(", "),
      code: await status(url),
    })),
  );

  rows.sort((a, b) => a.code - b.code || a.url.localeCompare(b.url));
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
