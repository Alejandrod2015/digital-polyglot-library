/** Captura una pagina local para revisarla antes de publicarla. */
import { chromium } from "playwright";

async function main() {
  const [file, out, theme] = process.argv.slice(2);
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: (theme as "dark" | "light") ?? "light",
  });
  await p.goto(`file://${file}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  await p.screenshot({ path: out });
  await b.close();
  console.log(out);
}
main();
