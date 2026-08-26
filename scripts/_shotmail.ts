/**
 * Los tres correos "we heard you" a PNG, para mirarlos como se miran los
 * correos: enteros y de un vistazo. Requiere `_renderBetaEmails.ts` antes y el
 * dev server en :3000 (las capturas de las tarjetas se sirven de ahi).
 *
 *   npx tsx scripts/_shotmail.ts
 */
import { chromium } from "playwright";

const OUT = "/tmp/claude-501/beta-emails";
const files = ["heard_you", "heard_you_colombe", "heard_you_ty"];

async function main() {
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({ viewport: { width: 620, height: 1200 }, deviceScaleFactor: 2 });
  for (const f of files) {
    await p.goto(`file://${OUT}/${f}.html`, { waitUntil: "networkidle" });
    await p.screenshot({ path: `${OUT}/${f}.png`, fullPage: true });
    console.log(f);
  }
  await b.close();
}
main();
