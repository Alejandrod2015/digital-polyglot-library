import { chromium } from "playwright";
async function main() {
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({ viewport: { width: 620, height: 1200 }, deviceScaleFactor: 3, colorScheme: "dark" });
  await p.goto(`file:///tmp/claude-501/beta-emails/improvement_colombe.html`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  const frame = p.locator("img[alt*='Tapping']").first();
  await frame.scrollIntoViewIfNeeded();
  const box = await frame.boundingBox();
  if (box) {
    // Marco entero, con aire alrededor: el problema esta en los bordes.
    await p.screenshot({
      path: "/tmp/claude-501/beta-emails/phone-frame.png",
      clip: { x: box.x - 24, y: box.y - 56, width: box.width + 48, height: box.height + 112 },
    });
    // Y la esquina inferior a lupa.
    await p.screenshot({
      path: "/tmp/claude-501/beta-emails/phone-bottom.png",
      clip: { x: box.x - 24, y: box.y + box.height - 120, width: box.width + 48, height: 176 },
    });
  }
  await b.close();
}
main();
