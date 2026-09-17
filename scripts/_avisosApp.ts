/**
 * Pantallazo de los dos avisos "Get the app" (fin de historia y claim),
 * capturados del dev server en :3007 y montados en marcos de telefono.
 * Scratch: se borra cuando el tema se cierre.
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3007";
const OUT = "/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library/81191d85-4574-42c1-bb48-1b0ce07bd6fc/scratchpad/shots";

const SHOTS = [
  {
    file: "aviso-fin-historia",
    url: `${BASE}/books/italian-short-stories-from-mysterious-venice/la-gondola-sussurrante`,
  },
  {
    file: "aviso-claim",
    url: `${BASE}/claim/preview-success`,
  },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("dp_cookie_consent_v1", "rejected");
    window.localStorage.setItem("dp-install-hint-dismissed-v2", "1");
  });
  const page = await context.newPage();

  for (const shot of SHOTS) {
    await page.goto(shot.url, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content:
        "nextjs-portal{display:none!important}[data-nextjs-toast]{display:none!important}nav.fixed{display:none!important}",
    });
    const cta = page.locator('a[href="/go/app"]').first();
    await cta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${shot.file}.png` });
    console.log(`ok ${shot.file}`);
  }

  const b64 = (f: string) => readFileSync(`${OUT}/${f}.png`).toString("base64");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0d1b2a;font-family:-apple-system,Segoe UI,sans-serif;color:#fff}
    .wrap{display:flex;gap:56px;justify-content:center;align-items:flex-start;padding:48px 56px}
    .col{display:flex;flex-direction:column;align-items:center;width:340px}
    .frame{background:#1c2b3f;border:1px solid rgba(255,255,255,.14);border-radius:44px;padding:12px;box-shadow:0 24px 64px rgba(0,0,0,.5)}
    .frame img{display:block;width:316px;border-radius:34px}
    h2{font-size:19px;margin:24px 0 6px;text-align:center}
    p{font-size:14px;line-height:1.45;color:rgba(255,255,255,.72);margin:0;text-align:center}
  </style></head><body><div class="wrap">
    <div class="col"><div class="frame"><img src="data:image/png;base64,${b64("aviso-fin-historia")}"></div>
      <h2>Usuario de la webapp</h2>
      <p>Al terminar de leer cualquier historia, debajo del último párrafo.</p></div>
    <div class="col"><div class="frame"><img src="data:image/png;base64,${b64("aviso-claim")}"></div>
      <h2>Comprador de audiolibro</h2>
      <p>En la pantalla donde reclama sus libros, justo bajo el botón de la biblioteca.</p></div>
  </div></body></html>`;
  writeFileSync(`${OUT}/avisos-app.html`, html);

  const compose = await context.newPage();
  await compose.setViewportSize({ width: 900, height: 600 });
  await compose.goto(`file://${OUT}/avisos-app.html`, { waitUntil: "networkidle" });
  await compose.waitForTimeout(300);
  await compose.screenshot({ path: `${OUT}/avisos-app.png`, fullPage: true });
  console.log("ok avisos-app.png");
  await browser.close();
}
main();
