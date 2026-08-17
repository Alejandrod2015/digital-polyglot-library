/**
 * Genera 2 tomas frescas del título narrado "La promesa del mole" con la voz
 * del narrador (andreti), bypassando la caché content-addressed (que devolvería
 * siempre la misma toma). NO escribe en la cache key del título; sube archivos
 * de audición opt2/opt3 para comparar. Si el usuario elige una, se hornea aparte.
 *
 * Cada llamada a stability 0.4 produce una toma distinta. next_text=" " (sin
 * previous_text) = misma config sin-aire del render.
 */
import fs from "fs";
import { spawn } from "child_process";
import os from "os";
import path from "path";

for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const VOICE = "JW8DGEuLp9WxIS5IdxMM"; // andreti narrator
const TITLE = "La promesa del mole.";

async function ff(args: string[]): Promise<void> {
  await new Promise<void>((res, rej) => {
    const p = spawn("ffmpeg", args);
    let e = "";
    p.stderr.on("data", (c) => (e += c));
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(e.slice(-300)))));
  });
}

async function main() {
  const { softenPunctuationForTts, DEFAULT_VOICE_SETTINGS, ELEVENLABS_MODEL_V2 } = (await import(
    "../src/lib/elevenlabs"
  )) as any;
  const { uploadPublicObject } = await import("../src/lib/objectStorage");
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const softened = softenPunctuationForTts(TITLE);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "titletakes-"));
  const urls: string[] = [];

  for (const n of [2, 3]) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: softened,
        model_id: ELEVENLABS_MODEL_V2,
        voice_settings: DEFAULT_VOICE_SETTINGS,
        next_text: " ",
      }),
    });
    if (!res.ok) throw new Error(`take ${n}: ${res.status} ${(await res.text()).slice(0, 200)}`);
    const raw = path.join(dir, `t${n}.mp3`);
    const out = path.join(dir, `t${n}_play.mp3`);
    fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    // trim cola suave + atempo 0.94 + loudnorm (audición)
    await ff([
      "-y", "-loglevel", "error", "-i", raw, "-af",
      "silenceremove=stop_periods=-1:stop_duration=0.08:stop_threshold=-45dB,atempo=0.94,loudnorm=I=-16:LRA=11:TP=-1.5",
      "-c:a", "libmp3lame", "-b:a", "192k", out,
    ]);
    const up = await uploadPublicObject({
      key: `media/samples/aire-fixed/titulo_opt${n}.mp3`,
      body: fs.readFileSync(out),
      contentType: "audio/mpeg",
    });
    console.log(`OPT${n}::${up!.url}`);
    urls.push(up!.url);
  }
  console.log("DONE");
}

main().catch((e) => { console.error(e); process.exit(1); });
