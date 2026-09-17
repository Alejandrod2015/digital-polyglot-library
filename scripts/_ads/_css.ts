import { chromium } from "playwright";
import { resolve } from "node:path";
(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const p = await (await b.newContext({ viewport: { width: 540, height: 675 } })).newPage();
  await p.goto(`file://${resolve("scripts/_ads/adScenes.html")}?scene=64&ratio=45`); await p.waitForTimeout(600);
  console.log(await p.evaluate(`(() => {
    const w = document.querySelector('#storyBody .w'), t = document.querySelector('#storyBody .wTail');
    const g = (e) => { const c = getComputedStyle(e); return { fw: c.fontWeight, fs: c.fontSize, lh: c.lineHeight, ls: c.letterSpacing, col: c.color }; };
    return { w: g(w), tail: g(t) };
  })()`));
  await b.close();
})();
