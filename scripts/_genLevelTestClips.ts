/**
 * The level test's OWN audio (user, 2026-09-20: "necesitamos ejercicios con
 * audio propio de la prueba de nivel"): renders every sentence (listen and
 * fill) and every tested word (meaning and match) of the Spanish bank with
 * ElevenLabs in ONE approved practice voice, passes each take through the
 * F0 gate (must end as a statement, never rising), uploads to R2 and writes
 * the URLs to `src/lib/levelTest/bank.es.audio.json`, which `buildLevelTest`
 * attaches to the exercises. No database involved.
 *
 *   npx tsx scripts/_genLevelTestClips.ts [--voice=<approved id>] [--force] [--dry]
 *
 * Idempotent: texts that already have a URL are skipped unless --force.
 * `--dry` lists what would be rendered and makes no TTS call. Rendering is
 * authorised only under the user's explicit "genera audio" instruction.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPublicObjectUrl, uploadPublicObject } from "../src/lib/objectStorage";
import { assertVoiceApproved } from "../src/lib/approvedVoices";
import { SPANISH_LEVEL_TEST_BANK } from "../src/lib/levelTest/bank.es";
import { F0GateUnavailable, preflightF0Gate, runF0Gate } from "./_f0gateClient"; // gate F0 (_f0gate.py), cerrado

const AUDIO_PATH = "src/lib/levelTest/bank.es.audio.json";
// Jhenny: the LATAM practice voice, clear and neutral; the test is one for
// every Spanish variant, so it does not follow any journey's narrator.
const DEFAULT_VOICE = "FXGrCtY3PEyfqczBAlqm";
const MODEL = "eleven_multilingual_v2";
const SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true };
const VERSION = "lt1";
const MAX_TRIES = 6;
// Same framing the practice clips use (see _genWordClips.ts): a declarative
// carrier in the language of the text so the model neither raises the end
// nor drifts to a foreign accent.
const WORD_CARRIER = { prev: "La palabra es:", next: " " };
const PHRASE_CARRIER = { prev: "Ahora escucha esta frase.", next: "Muy bien. Ahora sigamos con la siguiente." };

type Audio = { sentences: Record<string, string>; words: Record<string, string> };

function ff(args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn("ffmpeg", args);
    let e = "";
    p.stderr.on("data", (c) => (e += c));
    p.on("error", rej);
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(e.slice(0, 150)))));
  });
}

async function normalize(raw: Buffer, outPath: string): Promise<void> {
  const d = mkdtempSync(join(tmpdir(), "lt-"));
  const i = join(d, "i.mp3");
  try {
    writeFileSync(i, raw);
    await ff(["-y", "-loglevel", "error", "-i", i, "-af", "loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=0.15,adelay=90:all=1", "-codec:a", "libmp3lame", "-b:a", "128k", outPath]);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}

function key(kind: "sentence" | "word", voice: string, text: string): string {
  const h = crypto.createHash("sha256").update(`${VERSION}|${voice}|${text.toLowerCase()}`).digest("hex").slice(0, 20);
  return `media/level-test/${kind}-clip/${h}.mp3`;
}

async function tts(text: string, voice: string, apiKey: string, marco: { prev: string; next: string }): Promise<Buffer> {
  assertVoiceApproved(voice, "level-test-clip");
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text: `${text.replace(/[.?!]+$/, "")}.`, model_id: MODEL, voice_settings: SETTINGS, previous_text: marco.prev, next_text: marco.next }),
  });
  if (!r.ok) throw new Error(`TTS ${r.status} ${(await r.text()).slice(0, 80)}`);
  return Buffer.from(await r.arrayBuffer());
}

// Inverted gate, as in the practice generators: the "question" mode says
// ok when the end RISES; a statement must not, so a take is accepted when
// that check fails and the end was measured.
async function render(text: string, voice: string, apiKey: string, outPath: string, marco: { prev: string; next: string }): Promise<{ ok: boolean; tries: number; detail: string }> {
  let last = "sigue subiendo tras reintentos";
  for (let t = 1; t <= MAX_TRIES; t++) {
    try {
      await normalize(await tts(text, voice, apiKey, marco), outPath);
      const v = await runF0Gate(outPath, "question");
      if (v.end === null) {
        last = `f0 sin medir (${v.reason})`;
        continue;
      }
      if (!v.ok) return { ok: true, tries: t, detail: `slope ${v.slope} end ${v.end}` };
      last = "sigue subiendo tras reintentos";
    } catch (err) {
      if (err instanceof F0GateUnavailable) throw err;
    }
  }
  return { ok: false, tries: MAX_TRIES, detail: last };
}

const unmark = (s: string) => s.replace(/\[\[(.+?)\]\]/g, "$1");

(async () => {
  const voice = process.argv.find((a) => a.startsWith("--voice="))?.slice(8) ?? DEFAULT_VOICE;
  const force = process.argv.includes("--force");
  const dry = process.argv.includes("--dry");
  assertVoiceApproved(voice, "level-test-clip");
  const audio: Audio = JSON.parse(readFileSync(AUDIO_PATH, "utf8"));
  const sentences = new Set<string>();
  const words = new Set<string>();
  for (const stations of Object.values(SPANISH_LEVEL_TEST_BANK)) {
    for (const st of stations) {
      sentences.add(st.listen.sentence);
      sentences.add(unmark(st.fill.sentence));
      words.add(st.meaning.word);
      for (const p of st.match.pairs) words.add(p.word);
    }
  }
  const todoS = [...sentences].filter((s) => force || !audio.sentences[s]);
  const todoW = [...words].filter((w) => force || !audio.words[w]);
  console.log(`voz=${voice} | ${sentences.size} frases (${todoS.length} por hacer) | ${words.size} palabras (${todoW.length} por hacer)`);
  if (dry) {
    for (const s of todoS) console.log(`  frase: ${s}`);
    for (const w of todoW) console.log(`  palabra: ${w}`);
    return;
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("no ELEVENLABS_API_KEY");
  await preflightF0Gate();
  const outDir = mkdtempSync(join(tmpdir(), "ltout-"));
  const save = () => writeFileSync(AUDIO_PATH, JSON.stringify(audio, null, 2) + "\n");
  let failed = 0;
  const jobs: Array<{ kind: "sentence" | "word"; text: string }> = [
    ...todoS.map((text) => ({ kind: "sentence" as const, text })),
    ...todoW.map((text) => ({ kind: "word" as const, text })),
  ];
  for (const job of jobs) {
    const outPath = join(outDir, "c.mp3");
    const marco = job.kind === "sentence" ? PHRASE_CARRIER : WORD_CARRIER;
    const res = await render(job.text, voice, apiKey, outPath, marco);
    if (!res.ok) {
      failed++;
      console.log(`  x ${job.kind} "${job.text}" (${res.detail})`);
      continue;
    }
    const k = key(job.kind, voice, job.text);
    await uploadPublicObject({ key: k, body: readFileSync(outPath), contentType: "audio/mpeg" });
    const url = getPublicObjectUrl(k);
    (job.kind === "sentence" ? audio.sentences : audio.words)[job.text] = url;
    save();
    console.log(`  ok ${job.kind} "${job.text}" [${res.tries}t] ${res.detail}`);
  }
  console.log(`\n${jobs.length - failed}/${jobs.length} listos${failed ? `, ${failed} sin pasar el gate` : ""}`);
  if (failed) process.exit(1);
})().catch((e) => {
  console.log("FATAL", e.message);
  process.exit(1);
});
