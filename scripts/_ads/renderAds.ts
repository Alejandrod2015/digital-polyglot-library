/**
 * Las cinco animaciones para los anuncios de Meta.
 *
 *   npx tsx scripts/_ads/renderAds.ts              # las cinco, en 9:16 y 4:5
 *   npx tsx scripts/_ads/renderAds.ts --scene 2    # solo una
 *   npx tsx scripts/_ads/renderAds.ts --ratio 916  # solo un formato
 *
 * No hace falta el servidor de dev: la escena es un HTML suelto que enlaza el
 * CSS de la landing, asi que el telefono, el lector y Word Quest salen con los
 * mismos estilos que la home. Cada fotograma se pide por tiempo
 * (`__ad.seek(t)`), no se graba en tiempo real: la tirada es reproducible.
 *
 * Salida: qa/ads/<n>-<slug>-<ratio>.mp4 (H.264) y su primer fotograma en .jpg.
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const FPS = 30;
const OUT = "qa/ads";
const TMP = "/tmp/claude-501/dpl-ads";

const SLUGS: Record<number, string> = {
  1: "word-synced",
  2: "tap-a-word",
  3: "practice",
  4: "variants",
  5: "textbook-vs-real",
  6: "ahorita-mx",
  7: "hormigas-co",
  8: "habla-causa-pe",
  9: "previa-ar",
  10: "escoba-cl",
  11: "spaeti-de",
  12: "ahorita-mx-claro",
  13: "ahorita-sangre",
  14: "ahorita-texto",
  15: "ahorita-portada",
  16: "habla-causa-sangre",
  17: "barra-es-sangre",
  18: "ni-el-gato-es-sangre",
  19: "ni-el-gato-escritorio",
  20: "ni-el-gato-escritorio-entero",
  21: "ni-el-gato-azul",
  22: "animo-suelos-mx",
  23: "pancho-ar",
  27: "pisa-record-low",
  50: "practice-four",
  51: "lector-practice-gato",
  52: "lector-practice-quepedo-mx",
  53: "lector-practice-comedera-co",
  54: "lector-practice-roche-pe",
  55: "lector-practice-escoba-cl",
  56: "lector-practice-embalada-ar",
  60: "social-roche-pe",
  63: "lector-practice-quemas-co",
  64: "lector-practice-altiro-cl",
  65: "lector-practice-fiado-mx",
  66: "lector-practice-sabroso-co",
  671: "var-mx",
  672: "var-ar",
  673: "var-co",
  674: "var-es",
  675: "var-catalogo",
  681: "var2-co",
  682: "var2-mx",
  683: "var2-ar",
  684: "var2-es",
  685: "var2-catalogo",
  691: "var3-es",
  692: "var3-co",
  693: "var3-mx",
  694: "var3-ar",
  695: "var3-catalogo",
  701: "var4-pe",
  702: "var4-co",
  703: "var4-ar",
  704: "var4-es",
  705: "var4-catalogo",
  711: "var5-co",
  712: "var5-pe",
  713: "var5-ar",
  714: "var5-catalogo",
  61: "social-quiz-gato-es",
  62: "social-tour-6-countries",
};

/** Escena -> historia narrada. El audio sale del que ya tiene la historia
 *  publicada: no se sintetiza nada para un anuncio. */
const AUDIO_OF: Record<number, string> = { 6: "ahorita", 7: "hormigas", 8: "causa", 9: "previa", 10: "escoba", 11: "spaeti", 12: "ahorita", 13: "ahorita", 14: "ahorita", 15: "ahorita", 16: "causa", 17: "barra", 18: "gato", 19: "gato", 20: "gato", 21: "gato", 22: "suelos", 23: "pancho", 27: "gato", 51: "gato", 52: "pedo", 53: "comedera", 54: "roche", 55: "escoba", 56: "embalada", 60: "roche", 63: "quemas", 64: "altiro", 65: "fiado", 66: "sabroso", 671: "vmx", 672: "var", 673: "vco", 674: "ves", 681: "wco", 682: "wmx", 683: "war", 684: "wes", 691: "xes", 692: "yco", 693: "ymx", 694: "xar", 701: "zpe", 702: "zco", 703: "zar", 704: "zes", 711: "yco2", 712: "ype", 713: "yar" };

type Narration = { audio: string; audioStart: number };

/* Mono a estereo SIN perder 3 dB. El upmix por defecto de ffmpeg reparte la
 * potencia entre los dos canales, asi que una narracion mono sale 3 dB mas
 * floja que una estereo. En una pieza que corta entre cuatro historias eso se
 * oye como un bajon de volumen al cambiar de pais (paso el 2026-09-21: el
 * argentino y el colombiano, mono, iban 3 dB por debajo del mexicano). */
function toStereo(file: string): string {
  const ch = Number(execFileSync("ffprobe", ["-v", "error", "-select_streams", "a:0",
    "-show_entries", "stream=channels", "-of", "csv=p=0", file]).toString().trim());
  return ch === 1 ? "pan=stereo|c0=c0|c1=c0" : "aformat=channel_layouts=stereo";
}

function narration(scene: number): Narration | null {
  const key = AUDIO_OF[scene];
  if (!key || !existsSync("scripts/_ads/adStories.json")) return null;
  const all = JSON.parse(readFileSync("scripts/_ads/adStories.json", "utf8")) as Record<string, Narration>;
  const st = all[key];
  if (!st || !existsSync(st.audio)) {
    throw new Error(`falta el audio de ${key}; corre scripts/_ads/buildStories.ts`);
  }
  return st;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const onlyScene = arg("scene");
  const onlyRatio = arg("ratio");
  const scenes = onlyScene ? [Number(onlyScene)] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const ratios = onlyRatio ? [onlyRatio] : ["916", "45"];

  mkdirSync(OUT, { recursive: true });
  const page0 = resolve("scripts/_ads/adScenes.html");

  const browser = await chromium.launch({ channel: "chrome" });

  for (const ratio of ratios) {
    for (const scene of scenes) {
      const tag = `${scene}-${SLUGS[scene]}-${ratio === "916" ? "9x16" : "4x5"}`;
      const dir = `${TMP}/${tag}`;
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });

      const size = ratio === "916" ? { width: 540, height: 960 } : { width: 540, height: 675 };
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
      const page = await context.newPage();
      await page.goto(`file://${page0}?scene=${scene}&ratio=${ratio}`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      // Las portadas vienen de R2: sin esperarlas, los primeros fotogramas
      // saldrian con el hueco gris.
      await page.waitForFunction(
        () => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0),
        undefined,
        { timeout: 60_000 },
      );
      await page.waitForTimeout(250);

      const duration = await page.evaluate(() => (window as never as { __ad: { duration: number } }).__ad.duration);
      // Una escena puede pedir ir mas rapida: se pinta el mismo recorrido en
      // menos fotogramas y la voz se acelera igual (atempo no cambia el tono).
      const speed = await page.evaluate(() => (window as never as { __ad: { speed?: number } }).__ad.speed || 1);
      const outDur = Math.round((duration / speed) * 100) / 100;
      // Una escena puede callar la narracion antes del final (Lector + Practice).
      const audioUntil = await page.evaluate(() => (window as never as { __ad: { audioUntil: number | null } }).__ad.audioUntil);
      const audioFade = await page.evaluate(() => (window as never as { __ad: { audioFade: number } }).__ad.audioFade);
      // Sonidos de la app (public/sounds, los mismos bytes que el movil).
      const sfx = await page.evaluate(() => (window as never as { __ad: { sfx: { file: string; at: number }[] } }).__ad.sfx);
      // Trozos de narracion sueltos (formatos de redes): archivo, corte y momento.
      const clips = await page.evaluate(() => (window as never as { __ad: { clips?: { file: string; ss: number; len: number; at: number }[] } }).__ad.clips ?? []);
      const frames = Math.round(outDur * FPS);
      process.stderr.write(`  ${tag}: ${frames} fotogramas\n`);

      for (let f = 0; f < frames; f++) {
        await page.evaluate((t) => (window as never as { __ad: { seek: (n: number) => void } }).__ad.seek(t), (f / FPS) * speed);
        await page.screenshot({
          path: `${dir}/${String(f).padStart(4, "0")}.jpg`,
          type: "jpeg",
          quality: 95,
        });
      }
      await context.close();

      const mp4 = `${OUT}/${tag}.mp4`;
      const nar = narration(scene);
      const hasAudio = !!nar || sfx.length > 0 || clips.length > 0;
      const silent = hasAudio ? `${dir}/silent.mp4` : mp4;
      execFileSync("ffmpeg", [
        "-y",
        "-framerate", String(FPS),
        "-i", `${dir}/%04d.jpg`,
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        silent,
      ], { stdio: "pipe" });

      if (hasAudio) {
        const inputs: string[] = ["-i", silent];
        const chains: string[] = [];
        const labels: string[] = [];
        let n = 1;
        if (nar) {
          // El corte del audio empieza en el mismo segundo que la primera
          // palabra del karaoke, asi que la sincronia no se ajusta a ojo.
          inputs.push("-ss", String(nar.audioStart), "-t", String(duration), "-i", nar.audio);
          // Medio segundo de cierre: cortar la voz en seco suena a error.
          const fade = audioUntil
            ? `afade=t=out:st=${(audioUntil - audioFade).toFixed(2)}:d=${audioFade}`
            : `afade=t=out:st=${(duration - 0.5).toFixed(2)}:d=0.5`;
          const tempo = speed === 1 ? "" : `,atempo=${speed}`;
          chains.push(`[${n}:a]${fade}${tempo},aresample=44100,${toStereo(nar.audio)}[a${n}]`);
          labels.push(`[a${n}]`);
          n++;
        }
        for (const c of clips) {
          inputs.push("-ss", String(c.ss), "-t", String(c.len), "-i", c.file);
          const ms = Math.round(c.at * 1000);
          const out = Math.max(0, c.len - 0.08).toFixed(3);
          chains.push(`[${n}:a]afade=t=in:d=0.03,afade=t=out:st=${out}:d=0.08,aresample=44100,${toStereo(c.file)},adelay=${ms}|${ms}[a${n}]`);
          labels.push(`[a${n}]`);
          n++;
        }
        for (const hit of sfx) {
          // "ad:" = sonido propio del anuncio (scripts/_ads/sfx); el resto son
          // los mismos bytes que suenan en la app.
          inputs.push("-i", hit.file.startsWith("ad:") ? `scripts/_ads/sfx/${hit.file.slice(3)}` : `public/sounds/${hit.file}`);
          const ms = Math.round((hit.at / speed) * 1000);
          chains.push(`[${n}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[a${n}]`);
          labels.push(`[a${n}]`);
          n++;
        }
        // amix baja cada entrada a 1/N; normalize=0 deja cada sonido a su nivel.
        const graph = chains.join(";") + ";" + labels.join("") +
          `amix=inputs=${labels.length}:normalize=0:duration=longest,atrim=0:${outDur}[aout]`;
        execFileSync("ffmpeg", [
          "-y", ...inputs,
          "-filter_complex", graph,
          "-map", "0:v", "-map", "[aout]",
          "-c:v", "copy",
          "-c:a", "aac",
          "-b:a", "160k",
          "-t", String(outDur),
          "-movflags", "+faststart",
          mp4,
        ], { stdio: "pipe" });
        unlinkSync(silent);
      }

      // Primer fotograma como miniatura, para elegir sin abrir el video.
      execFileSync("cp", [`${dir}/0000.jpg`, `${OUT}/${tag}.jpg`]);

      console.log(`${mp4} (${Math.round(statSync(mp4).size / 1024)} KB, ${outDur}s${speed === 1 ? "" : ` a ${speed}x`})`);
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
