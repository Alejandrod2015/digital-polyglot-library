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
import { writeHarness, removeHarness, waitForHarness } from "./_glossHarness";

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

/** Fuera lo que no es la app: cookies, instalar, soporte. Se remontan, asi que
 *  se llama antes de CADA fotograma y no una sola vez. */
async function hideChrome(page: Page): Promise<void> {
  // Solo los hijos directos del body: los banners son portales al final del
  // documento. Barrer `body *` llegaba a ocultar un ancestro del texto, y con
  // el la palabra que hay que tocar.
  await page.evaluate(() => {
    Array.from(document.body.children).forEach((node) => {
      const el = node as HTMLElement;
      const text = (el.textContent ?? "").trim();
      if (text.startsWith("COOKIE CHOICES") || text.startsWith("Install Digital Polyglot")) {
        el.style.display = "none";
      }
    });
  });
}

/** `--only=<file>` regenera un solo clip, para depurar sin rehacer los dos. */
const onlyArg = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

async function main() {
  mkdirSync(OUT, { recursive: true });
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  writeHarness();
  await waitForHarness(BASE);

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

  const step = (msg: string) => console.log(`  · ${msg}`);

  for (const clip of CLIPS.filter((c) => !onlyArg || c.file === onlyArg)) {
    step(`${clip.file}: abriendo`);
    // `networkidle` se queda esperando por la portada, que viene de R2: se
    // espera a que la imagen este pintada, y con tope.
    await page.goto(`${BASE}/dev-glossshot?slug=${clip.slug}&mode=after`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page
      .waitForFunction(
        () => {
          const img = document.querySelector("img");
          return !img || (img.complete && img.naturalWidth > 0);
        },
        undefined,
        { timeout: 20_000 },
      )
      .catch(() => console.warn(`  aviso: la portada de ${clip.slug} no cargo a tiempo`));
    await page.addStyleTag({
      // Sin scroll suave: `scrollIntoViewIfNeeded` espera a que el elemento
      // este quieto, y con la animacion en marcha no lo esta nunca.
      content: [
        "nextjs-portal{display:none!important}",
        "[data-nextjs-toast]{display:none!important}",
        // El aviso de instalar la app, por su etiqueta, que es estable.
        '[aria-label="Install Digital Polyglot to your home screen"]{display:none!important}',
        "*{scroll-behavior:auto!important}",
      ].join(""),
    });

    step("portada lista");
    const word = page.locator(`[data-token="${clip.word}"]`).first();

    // Frames con su duracion en segundos. El ultimo se mantiene: es el estado
    // que el lector tiene que llevarse.
    const frames: Array<{ file: string; seconds: number }> = [];
    let n = 0;
    const grab = async (seconds: number) => {
      await hideChrome(page);
      const file = `${TMP}/f${String(n++).padStart(2, "0")}.png`;
      await page.screenshot({ path: file });
      frames.push({ file, seconds });
    };


    // Empieza por arriba: portada y titulo, que es la historia tal como se
    // abre. Sin eso, el correo enseña un parrafo suelto.
    await page.waitForTimeout(400);
    await grab(1.4);

    step("scroll a la palabra");
    await word.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(500);
    // Empieza por arriba: portada y titulo, que es la historia tal como se
    // abre. Sin eso, el correo enseña un parrafo suelto.
    await page.waitForTimeout(400);
    await grab(1.4);

    await word.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await ring(page, `[data-token="${clip.word}"]`);
    await grab(1.0);
    await unring(page);

    step("tap");
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
    step("cierre");
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
      // 780 px: el doble de los 256 a los que el correo lo pinta, que es lo
      // que pide una pantalla retina. A 468 el telefono se veia blando, y en
      // el visor con zoom, directamente mal.
      "[0:v]scale=780:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
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
