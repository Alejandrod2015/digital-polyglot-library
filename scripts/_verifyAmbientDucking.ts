/*
 * PROTOTYPE verification (exp/ambient-layer). Local ffmpeg only, no DB/R2.
 * Proves the variant-B playback envelope works on the DRY editor master:
 * renders the ambient bed with the SAME narrator-off ducking the player
 * applies, then measures the bed's loudness under a narrator window vs a
 * dialogue window. Narrator window must be ~silent; dialogue window audible.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "public", "_ambient-demo");
const meta = JSON.parse(readFileSync(join(DIR, "intervals.json"), "utf8")) as {
  totalDurationSec: number; ambientVolume: number;
  intervals: { start: number; end: number; narrator: boolean; speaker: string }[];
};

// Bed plays only under dialogue → off = narrator ranges (+ inter-fragment gaps,
// which we leave as bed-on for simplicity; the demo proves narrator muting).
const off = meta.intervals.filter((i) => i.narrator).map((i) => [i.start, i.end] as [number, number]);
const V = meta.ambientVolume;
const offExpr = off.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join("+");
const gainExpr = `${V}*(1-min(1,${offExpr}))`;

const ambient = join(DIR, "ambient.mp3");
const dur = meta.totalDurationSec;
const beddOut = join("/tmp", "bed_ducked.mp3");

// Render the ducked bed alone (loop ambient, apply per-frame gain envelope).
let r = spawnSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-stream_loop", "-1", "-t", String(dur), "-i", ambient,
  "-af", `volume='${gainExpr}':eval=frame`,
  "-c:a", "libmp3lame", "-b:a", "128k", beddOut,
]);
if (r.status !== 0) { console.error(r.stderr?.toString()); process.exit(1); }

function meanVolumeDb(path: string, start: number, end: number): number {
  const r = spawnSync("ffmpeg", [
    "-hide_banner", "-ss", String(start), "-to", String(end),
    "-i", path, "-af", "volumedetect", "-f", "null", "-",
  ]);
  const m = (r.stderr?.toString() ?? "").match(/mean_volume:\s*(-?[\d.]+) dB/);
  return m ? parseFloat(m[1]) : NaN;
}

// pick a narrator window and a dialogue window
const narr = meta.intervals.find((i) => i.narrator && i.end - i.start > 2)!;
const dlg = meta.intervals.find((i) => !i.narrator && i.end - i.start > 2)!;

const nWin: [number, number] = [narr.start + 0.4, Math.min(narr.end - 0.2, narr.start + 2.5)];
const dWin: [number, number] = [dlg.start + 0.4, Math.min(dlg.end - 0.2, dlg.start + 2.5)];

const nDb = meanVolumeDb(beddOut, ...nWin);
const dDb = meanVolumeDb(beddOut, ...dWin);

console.log("=== Ducked ambient bed (variant-B envelope, applied to dry master timeline) ===");
console.log(`narrator window  [${nWin[0].toFixed(1)}-${nWin[1].toFixed(1)}s]  "${narr.speaker}"  mean_volume = ${nDb} dB`);
console.log(`dialogue window  [${dWin[0].toFixed(1)}-${dWin[1].toFixed(1)}s]  "${dlg.speaker}"  mean_volume = ${dDb} dB`);
console.log(`difference: dialogue is ${(dDb - nDb).toFixed(1)} dB louder than narrator`);
console.log(nDb < -70 ? "PASS: bed is silent under narrator" : `CHECK: narrator window not silent (${nDb} dB)`);
console.log(dDb - nDb > 20 ? "PASS: bed clearly audible under dialogue, muted under narrator" : "CHECK: ducking contrast too small");

// ---- Also render the FULL playback mix (dry voice + ducked bed) so the user
// can listen to exactly what the variant-B player would output, and confirm
// the bed only ADDS energy under dialogue (never under the narrator). ----
const dry = join(DIR, "voice-dry.mp3");
const mixOut = join(DIR, "preview-mix.mp3");
r = spawnSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-i", dry,
  "-stream_loop", "-1", "-i", ambient,
  "-filter_complex",
    // No loudnorm: the variant-B player just sums voice + ducked bed (the dry
    // voice is already at -16 LUFS from generation). amix halves inputs, so
    // re-amplify x2 to keep the voice at its original level and let the bed add
    // on top; faithful to what the browser/RN player does.
    `[1:a]volume='${gainExpr}':eval=frame[bed];[0:a][bed]amix=inputs=2:duration=first:dropout_transition=2,volume=2[m]`,
  "-map", "[m]", "-c:a", "libmp3lame", "-b:a", "128k", mixOut,
]);
if (r.status !== 0) { console.error(r.stderr?.toString()); process.exit(1); }

console.log("\n=== Full playback mix rendered (dry voice + ducked bed, no loudnorm) ===");
console.log("Quantitative proof of ducking is the ISOLATED-BED test above. In the");
console.log("full mix the bed is intentionally subtle (vol 0.10), so the loud voice");
console.log("dominates the aggregate dB and masks the bed there; confirm fidelity by ear:");
console.log(`-> public/_ambient-demo/preview-mix.mp3  (listen: localhost:3000/_ambient-demo/preview-mix.mp3)`);
