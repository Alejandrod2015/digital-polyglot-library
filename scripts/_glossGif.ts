/**
 * La animacion del correo de la mejora: una palabra que se toca, la tarjeta que
 * se abre y la conjugacion que se despliega, dentro de la pantalla del telefono.
 * Sale a public/email/glosses/<palabra>-tap.gif, que es de donde la sirve el
 * correo.
 *
 *   npm run dev                  # el harness necesita el server en :3000
 *   npx tsx scripts/_glossGif.ts
 *
 * GIF y no video ni CSS: un correo no ejecuta nada. Outlook de escritorio
 * ademas se queda con el PRIMER fotograma, asi que el primero ya enseña la
 * historia con el dedo sobre la palabra y se entiende parado.
 */
import { chromium, type Page } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, statSync } from "node:fs";
import { writeHarness, removeHarness } from "./_glossHarness";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "public/email/glosses";
const TMP = "/tmp/claude-501/gloss-gif";

type Clip = { slug: string; word: string; file: string };

const CLIPS: Clip[] = [
  { slug: "marta-ensena-el-retiro", word: "baja", file: "baja-tap" },
  { slug: "le-toca-a-mateo", word: "punto", file: "punto-tap" },
];

/** Anillo de toque sobre un elemento, para que se lea como un dedo y no como un salto. */
async function ring(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dot = document.createElement("div");
    dot.id = "tap-ring";
    dot.style.cssText = [
      "position:fixed",
      `left:${r.left + r.width / 2 - 26}px`,
      `top:${r.top + r.height / 2 - 26}px`,
      "width:52px",
      "height:52px",
      "border-radius:50%",
      "background:rgba(255,255,255,0.22)",
      "border:2px solid rgba(255,255,255,0.75)",
      "z-index:9999",
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(dot);
  }, selector);
}

async function unring(page: Page): Promise<void> {
  await page.evaluate(() => document.getElementById("tap-ring")?.remove());
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  writeHarness();
  await new Promise((r) => setTimeout(r, 1500));

  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("dp_cookie_consent_v1", "rejected");
  });
  const page = await context.newPage();

  for (const clip of CLIPS) {
    await page.goto(`${BASE}/dev-glossshot?slug=${clip.slug}&mode=after`, {
      waitUntil: "networkidle",
    });
    await page.addStyleTag({
      content: "nextjs-portal{display:none!important}[data-nextjs-toast]{display:none!important}",
    });

    const word = page.locator(`[data-token="${clip.word}"]`).first();
    await word.scrollIntoViewIfNeeded();

    // Frames con su duracion en segundos. El ultimo se mantiene: es el estado
    // que el lector tiene que llevarse.
    const frames: Array<{ file: string; seconds: number }> = [];
    let n = 0;
    const grab = async (seconds: number) => {
      const file = `${TMP}/f${String(n++).padStart(2, "0")}.png`;
      await page.screenshot({ path: file });
      frames.push({ file, seconds });
    };

    await page.evaluate(() => {
      document.querySelectorAll("body *").forEach((node) => {
        const el = node as HTMLElement;
        const text = (el.textContent ?? "").trim();
        if (text.startsWith("COOKIE CHOICES") || text.startsWith("Install Digital Polyglot")) {
          el.style.display = "none";
        }
      });
    });

    await ring(page, `[data-token="${clip.word}"]`);
    await grab(1.0);
    await unring(page);

    await word.click();
    await page.locator("text=QUICK LOOKUP").first().waitFor({ state: "visible" });
    await page.waitForTimeout(200);
    await grab(1.6);

    const expand = page.getByRole("button", { name: /See conjugation|See all|See \d+ more/ }).first();
    if (await expand.count()) {
      const id = await expand.evaluate((el) => {
        el.setAttribute("data-shot-target", "1");
        return "1";
      });
      if (id) {
        await ring(page, "[data-shot-target]");
        await grab(0.5);
        await unring(page);
        await expand.click();
        await page.waitForTimeout(250);
      }
    }
    await grab(3.0);

    // ffmpeg con el demuxer concat: duracion por fotograma sin repetirlos.
    const list = frames
      .map((f) => `file '${f.file}'\nduration ${f.seconds}`)
      .concat([`file '${frames[frames.length - 1].file}'`])
      .join("\n");
    writeFileSync(`${TMP}/list.txt`, list);

    const gif = `${OUT}/${clip.file}.gif`;
    // Una paleta para todo el clip: los fotogramas comparten fondo y colores,
    // y una paleta por fotograma haria bailar el color entre pasos.
    execFileSync("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", `${TMP}/list.txt`,
      "-filter_complex",
      "[0:v]scale=468:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3",
      "-loop", "0",
      gif,
    ], { stdio: "pipe" });

    console.log(`${gif} (${Math.round(statSync(gif).size / 1024)} KB, ${frames.length} frames)`);
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
