/**
 * RE-TIRA un parrafo del A0 argentino y deja la toma buena EN LA CACHE de
 * segmentos, para que el render del journey la herede y no se vuelva a pagar.
 *
 * WHY: el 2026-08-23 el usuario oyo "de las nueve" donde el texto dice "a las
 * nueve", en el primer parrafo de "El sobre del dueno". El gate de contenido no
 * lo agarra: Scribe transcribe "a las nueve" porque el STT normaliza hacia el
 * texto (project_stt_detector_blind_spot). El oido manda, y la salida es
 * re-tirar. Como la cache es content-addressed, volver a renderizar sin
 * sobrescribir la clave devolveria la MISMA toma mala.
 *
 * Cada toma pasa por el gate F0 (scripts/_f0gate.py, modo statement), igual que
 * el pipeline, y se transcribe con Scribe para dejar constancia de lo que se oye.
 *
 *   npx tsx scripts/_arReroll.ts --slug=el-sobre-del-dueno --para=0 --takes=2
 *   npx tsx scripts/_arReroll.ts --slug=el-sobre-del-dueno --para=0 --apply=2
 *
 * Sin --apply no toca R2 ni la base: escribe las tomas en public/_muestra-ar/
 * para escucharlas. Con --apply=N sube esa toma a la clave de cache del segmento.
 * GATED: solo corre con el verbo de audio del usuario.
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { execFile } from "child_process";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { promisify } from "util";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { DEFAULT_VOICE_SETTINGS, multivoiceSegmentCacheKey, softenPunctuationForTts } from "../src/lib/elevenlabs";
import { uploadPublicObject, getPublicObjectUrl } from "../src/lib/objectStorage";
import { assertVoiceApproved } from "../src/lib/approvedVoices";

const execFileAsync = promisify(execFile);
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const SLUG = arg("slug") ?? "el-sobre-del-dueno";
const PARA = Number(arg("para") ?? 0);
const TAKES = Number(arg("takes") ?? 2);
const APPLY = arg("apply") ? Number(arg("apply")) : null;
const VOICE = "p7AwDmKvTdoHTBuueGvP"; // Malena (AR), aprobada 2026-08-23
const OUT = path.resolve("public/_muestra-ar");
const F0_PY = path.join(process.env.HOME || "", ".cache", "dpl-qa", "venv", "bin", "python");
const EL = "https://api.elevenlabs.io/v1";

async function f0(mp3: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(F0_PY, ["scripts/_f0gate.py", mp3, "statement"]);
    const v = JSON.parse(stdout.trim());
    return `${v.ok ? "ok" : "UPTALK"} (slope ${v.slope}, end ${v.end})`;
  } catch (e) { return `gate F0 no disponible (${(e as Error).message.slice(0, 60)})`; }
}

async function scribe(mp3: string, key: string): Promise<string> {
  const fd = new FormData();
  fd.append("model_id", "scribe_v1"); fd.append("language_code", "spa");
  fd.append("file", new Blob([new Uint8Array(readFileSync(mp3))], { type: "audio/mpeg" }), "s.mp3");
  const r = await fetch(`${EL}/speech-to-text`, { method: "POST", headers: { "xi-api-key": key }, body: fd });
  return String(((await r.json()) as { text?: string }).text ?? "").trim();
}

(async () => {
  assertVoiceApproved(VOICE, `reroll:${SLUG}`);
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const prisma = new PrismaClient();
  const s = await prisma.journeyStory.findFirst({ where: { slug: SLUG }, select: { text: true } });
  await prisma.$disconnect();
  const texto = s?.text?.split("\n\n")[PARA];
  if (!texto) throw new Error(`sin parrafo ${PARA} en ${SLUG}`);
  const softened = softenPunctuationForTts(texto);
  const cacheKey = multivoiceSegmentCacheKey(VOICE, softened, "eleven_multilingual_v2" as never, undefined, true);
  console.log(`parrafo ${PARA} de ${SLUG}\n${texto}\n\nclave de cache: ${cacheKey}\n`);
  mkdirSync(OUT, { recursive: true });

  if (APPLY !== null) {
    const body = readFileSync(path.join(OUT, `take${APPLY}.mp3`));
    const r = await uploadPublicObject({ key: cacheKey, body, contentType: "audio/mpeg" } as never);
    console.log(r ? `toma ${APPLY} en la cache: ${getPublicObjectUrl(cacheKey)}` : "FALLO la subida");
    return;
  }

  for (let n = 1; n <= TAKES; n++) {
    const res = await fetch(`${EL}/text-to-speech/${VOICE}`, {
      method: "POST", headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: softened, model_id: "eleven_multilingual_v2",
        voice_settings: DEFAULT_VOICE_SETTINGS, next_text: " ",
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const f = path.join(OUT, `take${n}.mp3`);
    writeFileSync(f, Buffer.from(await res.arrayBuffer()));
    console.log(`toma ${n}: ${await f0(f)}\n   Scribe oye: ${await scribe(f, apiKey)}\n   /_muestra-ar/take${n}.mp3`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
