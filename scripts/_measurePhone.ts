/** Mide marco, pantalla e imagen del bloque phoneShot dentro de un correo. */
import { chromium } from "playwright";

async function main() {
  const file = process.argv[2];
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({ viewport: { width: 620, height: 1200 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await p.goto(`file://${file}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  // Sin funciones nombradas dentro del evaluate: esbuild las reescribe con
  // `__name` y la pagina no tiene ese helper.
  const data = await p.evaluate(() => {
    const img = document.querySelector("img[alt*='Tapping']") as HTMLImageElement | null;
    if (!img) return null;
    const chain: Element[] = [];
    let node: Element | null = img;
    while (node && chain.length < 4) {
      chain.push(node);
      node = node.parentElement;
    }
    return {
      natural: { w: img.naturalWidth, h: img.naturalHeight },
      chain: chain.map((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          w: Math.round(r.width * 100) / 100,
          h: Math.round(r.height * 100) / 100,
          bg: cs.backgroundColor,
          radius: cs.borderRadius,
          pad: cs.padding,
          border: cs.borderWidth,
          display: cs.display,
        };
      }),
    };
  });
  console.log(JSON.stringify(data, null, 1));
  await b.close();
}
main();
