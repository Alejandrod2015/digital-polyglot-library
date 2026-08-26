/** Recorte del bloque del telefono en un correo, para juzgar la nitidez. */
import { chromium } from "playwright";

async function main() {
  const [file, out] = process.argv.slice(2);
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({ viewport: { width: 620, height: 1200 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await p.goto(`file://${file}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  const phone = p.locator("img[alt*='Tapping']").first();
  await phone.scrollIntoViewIfNeeded();
  await phone.screenshot({ path: out });
  await b.close();
  console.log(out);
}
main();
