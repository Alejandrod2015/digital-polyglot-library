/**
 * Capturas de la tarjeta del lookup para el correo de la mejora
 * (src/lib/emails/beta.ts, kind `improvement`). Salen a public/email/glosses,
 * que es de donde las sirve el correo.
 *
 *   npm run dev            # el harness necesita el server en :3000
 *   npx tsx scripts/_glossShots.ts
 *
 * Solo el estado NUEVO: el correo no enseña un "antes" que ya no existe.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { writeHarness, removeHarness, waitForHarness } from "./_glossHarness";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "public/email/glosses";

type Shot = { file: string; slug: string; word: string; expand?: boolean };

const SHOTS: Shot[] = [
  { file: "baja-after", slug: "marta-ensena-el-retiro", word: "baja", expand: true },
  { file: "punto-after", slug: "le-toca-a-mateo", word: "punto", expand: true },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeHarness();
  await waitForHarness(BASE);
  // Usa el Chrome ya instalado: playwright no tiene su binario descargado.
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    // 2x basta: en el correo la captura se pinta a 256 px de ancho.
    deviceScaleFactor: 2,
    // La app se lee en oscuro y el correo es oscuro: una captura clara
    // dentro del correo parece de otro producto.
    colorScheme: "dark",
  });
  // El banner de cookies tapa la tarjeta. Se responde antes de cargar (la
  // opcion que menos rastrea) para que no llegue a montarse.
  await context.addInitScript(() => {
    window.localStorage.setItem("dp_cookie_consent_v1", "rejected");
  });
  const page = await context.newPage();

  for (const shot of SHOTS) {
    await page.goto(`${BASE}/dev-glossshot?slug=${shot.slug}`, {
      waitUntil: "networkidle",
    });
    // Fuera todo lo que no es la app: el banner de cookies, el de instalar, el
    // globo de soporte y el indicador de dev de Next.
    await page.addStyleTag({
      content: "nextjs-portal{display:none!important}[data-nextjs-toast]{display:none!important}",
    });

    const word = page.locator(`[data-token="${shot.word}"]`).first();
    await word.scrollIntoViewIfNeeded();
    await word.click();
    const card = page.locator("text=QUICK LOOKUP").locator("xpath=ancestor::div[3]").first();
    await card.waitFor({ state: "visible" });

    if (shot.expand) {
      const link = page.getByRole("button", { name: /See conjugation|See all|See \d+ more/ }).first();
      if (await link.count()) {
        await link.click();
        await page.waitForTimeout(150);
      }
    }
    // Se limpia DESPUES de abrir la tarjeta: los banners se remontan al
    // hidratar y volverian a asomar por debajo del popup. Sin funciones
    // nombradas aqui dentro: esbuild las reescribe con `__name` y la pagina
    // no tiene ese helper.
    await page.evaluate(() => {
      document.querySelectorAll("body *").forEach((node) => {
        const el = node as HTMLElement;
        const text = (el.textContent ?? "").trim();
        if (text.includes("QUICK LOOKUP")) return;
        const fixed = getComputedStyle(el).position === "fixed";
        if (
          text.startsWith("COOKIE CHOICES") ||
          text.startsWith("Install Digital Polyglot") ||
          (fixed && el.clientHeight < 120 && el.clientWidth < 120)
        ) {
          el.style.display = "none";
        }
      });
    });
    await page.waitForTimeout(250);
    // La pantalla entera, no la tarjeta recortada: en el correo va dentro de
    // un telefono, y un recorte suelto dentro del marco no se lee como la app.
    await page.screenshot({ path: `${OUT}/${shot.file}.png` });
    console.log(`${shot.file}.png`);
  }

  await browser.close();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    removeHarness();
  });
