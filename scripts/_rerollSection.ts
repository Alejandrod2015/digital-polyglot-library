/**
 * Re-render ONE fragment (paragraph) of an existing story master and splice it
 * back in, keeping the master's time-stretch and running the F0 anti-uptalk
 * gate on every take.
 *
 * Usage:
 *   npx tsx scripts/_rerollSection.ts <slug> <fragmentIndex> [--takes 3] [--tempo 0.94] [--apply]
 *
 * Without --apply it renders + measures + writes the candidate to disk and
 * changes NOTHING in R2 or the DB.
 *
 * WHY this exists (2026-08-03): the maintained Studio route
 * (/api/studio/audio-editor/regenerate) synthesizes a fresh take and splices
 * it, but for masters that went through `normalizeAudioPace` it splices an
 * UNSTRETCHED fragment into a STRETCHED master (the stored sections carry the
 * `_slow` suffix and match the master; a fresh take does not), and it never
 * runs the F0 gate. Both matter here: the whole point of the re-roll is
 * intonation, so an ungated take can reproduce the defect it is meant to fix.
 *
 * Cost: one ElevenLabs call per take, for ONE paragraph. Takes beyond the
 * first are only spent when the gate rejects.
 *
 * The F0 gate used is scripts/_f0gate.py (statement mode); same gate as the
 * generation pipeline, required by the guard for any TTS-emitting script.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { execFile } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { PrismaClient } from "../src/generated/prisma";
import {
  DEFAULT_NARRATION_TEMPO,
  DEFAULT_VOICE_SETTINGS,
  normalizeLoudness,
  softenPunctuationForTts,
} from "../src/lib/elevenlabs";
import { assertVoiceApproved } from "../src/lib/approvedVoices";
import { coerceFragments, replaceSectionAndRebuild } from "../src/lib/audioEditorSections";

const execFileAsync = promisify(execFile);
const prisma = new PrismaClient();
const F0_PY = `${process.env.HOME}/.cache/dpl-qa/venv/bin/python`;
const UPTALK_ST = 4.0; // same threshold the pipeline uses today

function arg(flag: string, dflt?: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

async function f0(file: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(F0_PY, ["scripts/_f0gate.py", file, "statement"]);
    const j = JSON.parse(stdout.trim()) as { end?: number | null };
    return typeof j.end === "number" ? j.end : null;
  } catch {
    return null;
  }
}

async function main() {
  const slug = process.argv[2];
  const index = Number(process.argv[3]);
  const takes = Number(arg("--takes", "3"));
  const tempo = Number(arg("--tempo", String(DEFAULT_NARRATION_TEMPO)));
  const apply = process.argv.includes("--apply");
  if (!slug || Number.isNaN(index)) {
    throw new Error("usage: _rerollSection.ts <slug> <fragmentIndex> [--takes N] [--tempo T] [--apply]");
  }

  const story = await prisma.journeyStory.findFirst({
    where: { slug },
    select: { id: true, title: true, audioUrl: true, audioFragments: true },
  });
  if (!story) throw new Error(`story ${slug} not found`);
  const frags = coerceFragments(story.audioFragments);
  if (!frags) throw new Error("story has no audioFragments; run backfillAudioSections first");
  const frag = frags.find((f) => f.index === index);
  if (!frag) throw new Error(`fragment ${index} not found (has ${frags.length})`);

  assertVoiceApproved(frag.voiceId);

  // GUARD DE DESFASE (2026-08-17). El empalme corta el máster en los
  // [startSec, endSec] guardados en `audioFragments`, dando por hecho que caen
  // dentro del silencio entre secciones. Si el máster cambió de duración
  // después de medirse esos offsets, el corte cae en otro sitio y parte una
  // palabra por la mitad: el máster empalmado sale con restos tipo "l--",
  // "n--", "tas--" JUSTO en la costura.
  //
  // Pasó el 2026-08-17 con siete historias del A0 portugués. La causa: sus
  // másters llevan sufijo `_slow`, o sea pasaron por `normalizeAudioPace`
  // DESPUÉS de medirse los fragmentos, y el estirado desplazó todos los
  // tiempos. En "A areia" los fragmentos creían que el audio duraba 1,84s más
  // de lo que dura. Las tomas nuevas sonaban limpias por separado; era el
  // corte lo que rompía.
  //
  // Antes de gastar una sola llamada de TTS, se compara la duración real del
  // máster con el final del último fragmento. Si no cuadran, se aborta: mejor
  // no corregir que dejarlo peor.
  {
    const { stdout: durOut } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", story.audioUrl!,
    ]);
    const masterDur = Number(durOut);
    const lastEnd = Math.max(...frags.map((f) => Number(f.endSec)));
    const drift = masterDur - lastEnd;
    if (Number.isFinite(masterDur) && Math.abs(drift) > 0.3) {
      throw new Error(
        `OFFSETS DESFASADOS: el máster dura ${masterDur.toFixed(2)}s y el último fragmento acaba en ` +
        `${lastEnd.toFixed(2)}s (desfase ${drift.toFixed(2)}s). Los tiempos guardados no describen ESTE audio, ` +
        `así que el corte caería fuera del silencio y partiría una palabra por la mitad. Es lo que dejó ` +
        `restos "l--" / "n--" / "tas--" en siete historias el 2026-08-17. Re-mide los fragmentos contra el ` +
        `máster actual antes de re-tirar (scripts/_remeasureFragments.ts).`
      );
    }
    console.log(`offsets  desfase ${drift.toFixed(2)}s frente al máster (tolerancia 0.30s) ✓`);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");

  // El fragmento 0 ES el título, así que su fuente de verdad es
  // `story.title`, no el texto congelado en `audioFragments`. Si el título
  // cambió después de renderizar, el fragmento guardado es el viejo y
  // re-tirarlo tal cual volvería a narrar el título anterior. Al pasar
  // `newText` en el empalme, el fragmento queda además sincronizado.
  const storedText = String(frag.text).trim();
  const source = index === 0 ? String(story.title).trim() : storedText;
  const retitled = index === 0 && source !== storedText;
  // Title fragment: a bare noun phrase reads better with a terminal period.
  const raw = source;
  const ttsText = index === 0 && !/[.!?…:]$/.test(raw) ? `${raw}.` : raw;
  if (retitled) console.log(`título    CAMBIÓ: "${storedText}" -> "${source}"`);
  const spanSec = Number(frag.endSec) - Number(frag.startSec);

  console.log(`story    "${story.title}" (${slug})`);
  console.log(`fragment [${index}] voice=${frag.voiceId} span=${spanSec.toFixed(2)}s en el máster`);
  console.log(`texto    ${ttsText.slice(0, 90)}${ttsText.length > 90 ? "…" : ""}`);
  console.log(`tempo    ${tempo} (se aplica al take nuevo para igualar el máster)`);
  console.log(`takes    hasta ${takes}, gate F0 statement, umbral +${UPTALK_ST} st\n`);

  const dir = mkdtempSync(path.join(tmpdir(), "reroll-"));
  const scored: Array<{ file: string; end: number | null; n: number }> = [];

  for (let n = 1; n <= takes; n++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${frag.voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: softenPunctuationForTts(ttsText),
        model_id: "eleven_multilingual_v2",
        voice_settings: DEFAULT_VOICE_SETTINGS,
        next_text: " ", // seam-breath suppression, disableStitching parity
      }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const rawFile = path.join(dir, `take${n}_raw.mp3`);
    writeFileSync(rawFile, Buffer.from(await res.arrayBuffer()));

    // Match the master's time-stretch BEFORE measuring, so the number we
    // gate on describes the audio that will actually ship.
    const slowFile = path.join(dir, `take${n}.mp3`);
    await execFileAsync("ffmpeg", ["-v", "error", "-y", "-i", rawFile,
      "-filter:a", `atempo=${tempo}`, "-c:a", "libmp3lame", "-b:a", "192k", slowFile]);

    const end = await f0(slowFile);
    const { stdout: dur } = await execFileAsync("ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", slowFile]);
    console.log(`  take ${n}: ${Number(dur).toFixed(2)}s  F0_end=${end === null ? "n/a" : end.toFixed(1) + " st"}` +
      `${end !== null && end >= UPTALK_ST ? "  UPTALK, re-tiro" : "  ok"}`);
    scored.push({ file: slowFile, end, n });
    if (end === null || end < UPTALK_ST) break;
  }

  const usable = scored.filter((s) => s.end !== null);
  const best = usable.length
    ? usable.reduce((m, s) => ((s.end as number) < (m.end as number) ? s : m))
    : scored[0];
  console.log(`\nelegido: take ${best.n} (F0_end=${best.end === null ? "n/a" : best.end.toFixed(1)})`);

  const out = path.join(process.cwd(), `_reroll_${slug}_${index}.mp3`);
  const normalized = await normalizeLoudness(readFileSync(best.file));
  writeFileSync(out, normalized);
  console.log(`candidato escrito en ${out}`);

  if (!apply) {
    console.log("\ndry run: R2 y la base sin tocar. Re-ejecuta con --apply para empalmarlo.");
    await prisma.$disconnect();
    return;
  }

  const r = await replaceSectionAndRebuild({
    storyId: story.id,
    fragmentIndex: index,
    newSectionBuffer: normalized,
    normalizeSection: false, // ya normalizado arriba
    ...(retitled ? { newText: source } : {}),
  });
  console.log(`máster nuevo: ${r.audioUrl}`);
  console.log(`máster viejo (rollback): ${story.audioUrl}`);
  console.log("\nOJO: audioWordTimings y audioSegments quedan desfasados. Hay que re-alinear.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
