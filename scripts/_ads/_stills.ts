import { chromium } from "playwright";
import { resolve } from "node:path";
const scene = process.argv[2]; const times = process.argv[3].split(",").map(Number); const out = process.argv[4];
// Quinto argumento opcional: "45" para el feed 4:5; por defecto 9:16.
const ratio = process.argv[5] === "45" ? "45" : "916";
(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const ctx = await b.newContext({ viewport: { width: 540, height: ratio === "45" ? 675 : 960 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs: string[] = []; p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto(`file://${resolve("scripts/_ads/adScenes.html")}?scene=${scene}&ratio=${ratio}`, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
  if (errs.length) { console.log(errs.join("\n")); }
  for (const t of times) { await p.evaluate((x) => (window as any).__ad.seek(x), t); await p.screenshot({ path: `${out}/s${scene}-${ratio}-${t}.png` }); }
  console.log(errs.join("\n") || "no errors"); await b.close();
})();
