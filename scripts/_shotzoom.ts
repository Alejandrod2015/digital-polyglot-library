/** Comprueba el control de tamano de la pagina de correos a varios valores. */
import { chromium } from "playwright";

async function main() {
  const file = process.argv[2];
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "dark" });
  await p.goto(`file://${file}`, { waitUntil: "networkidle" });
  for (const pct of ["100", "140", "220"]) {
    await p.locator("#scale").fill(pct);
    await p.waitForTimeout(250);
    const box = await p.locator(".panel.is-open [data-mail]").boundingBox();
    console.log(pct, JSON.stringify(box));
    await p.screenshot({ path: `/tmp/claude-501/beta-emails/zoom-${pct}.png` });
  }
  await b.close();
}
main();
