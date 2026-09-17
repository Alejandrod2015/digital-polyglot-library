/**
 * Dos capturas reales de localhost:3007 a 390x844 (la misma app, dos
 * cuentas) y una composicion final con marco de telefono y rotulo.
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const BASE = "http://localhost:3007";
const OUT = "/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library/81191d85-4574-42c1-bb48-1b0ce07bd6fc/scratchpad/shots";

const SHOTS = [
  {
    file: "cuenta-premium",
    url: `${BASE}/books/colombian-spanish-stories-for-beginners/la-leyenda-del-mohan`,
    scrollTo: null as string | null,
  },
  {
    file: "cuenta-nueva",
    url: `${BASE}/books/colombian-spanish-stories-for-beginners/el-mercado-de-medellin`,
    scrollTo: "text=Unlock every story",
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
        "nextjs-portal{display:none!important}[data-nextjs-toast]{display:none!important}nav.fixed{display:none!important}a[href*=\"sign-in\"]{display:none!important}",
    });
    if (shot.scrollTo) {
      const el = page.locator(shot.scrollTo).first();
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${shot.file}.png` });
    console.log(`ok ${shot.file}`);
  }

  // Composicion: dos telefonos lado a lado con rotulo, misma estetica oscura.
  const b64 = (f: string) => readFileSync(`${OUT}/${f}.png`).toString("base64");
  const html = `<!doctype html><html><head><meta charset=\"utf-8\"><style>
    body{margin:0;background:#0d1b2a;font-family:-apple-system,Segoe UI,sans-serif;color:#fff}
    .wrap{display:flex;gap:56px;justify-content:center;align-items:flex-start;padding:48px 56px}
    .col{display:flex;flex-direction:column;align-items:center;width:340px}
    .frame{background:#1c2b3f;border:1px solid rgba(255,255,255,.14);border-radius:44px;padding:12px;box-shadow:0 24px 64px rgba(0,0,0,.5)}
    .frame img{display:block;width:316px;border-radius:34px}
    h2{font-size:19px;margin:24px 0 6px;text-align:center}
    p{font-size:14px;line-height:1.45;color:rgba(255,255,255,.72);margin:0;text-align:center}
  </style></head><body><div class="wrap">
    <div class="col"><div class="frame"><img src="data:image/png;base64,${b64("cuenta-premium")}"></div>
      <h2>Lo que María pagó</h2>
      <p>Su cuenta de siempre en la web: la historia abierta, con su audio y su plan premium.</p></div>
    <div class="col"><div class="frame"><img src="data:image/png;base64,${b64("cuenta-nueva")}"></div>
      <h2>Lo que ve en su iPhone nuevo</h2>
      <p>Entró con Apple y ocultó su correo: la app le creó otra cuenta y le pide pagar lo que ya pagó.</p></div>
  </div></body></html>`;
  writeFileSync(`${OUT}/dos-vidas.html`, html);

  const compose = await context.newPage();
  await compose.setViewportSize({ width: 900, height: 600 });
  await compose.goto(`file://${OUT}/dos-vidas.html`, { waitUntil: "networkidle" });
  await compose.waitForTimeout(300);
  await compose.screenshot({ path: `${OUT}/maria-dos-cuentas.png`, fullPage: true });
  console.log("ok maria-dos-cuentas.png");
  await browser.close();
}
main();
