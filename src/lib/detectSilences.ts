// ffmpeg silencedetect wrapper.
//
// Server-only module: uses child_process / ffmpeg. Do NOT import from the
// mobile or browser bundle.

import { spawn } from "child_process";

export type SilenceSpan = { start: number; end: number; duration: number };

/**
 * Run ffmpeg silencedetect on the given audio URL (or local path) and
 * return every detected silence span. The filter logs to stderr, so
 * we collect stderr and parse the `silence_start` / `silence_end`
 * pairs.
 */
export async function detectSilences(
  audioUrl: string,
  options: { thresholdDb?: number; minDurationSec?: number } = {}
): Promise<SilenceSpan[]> {
  const thresholdDb = options.thresholdDb ?? -35;
  const minDurationSec = options.minDurationSec ?? 0.3;

  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-i",
      audioUrl,
      "-af",
      `silencedetect=noise=${thresholdDb}dB:duration=${minDurationSec}`,
      "-f",
      "null",
      "-",
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }
      const spans: SilenceSpan[] = [];
      const startRe = /silence_start:\s*(-?[\d.]+)/g;
      const endRe = /silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g;
      const starts: number[] = [];
      let m: RegExpExecArray | null;
      while ((m = startRe.exec(stderr)) !== null) {
        starts.push(parseFloat(m[1]));
      }
      let i = 0;
      while ((m = endRe.exec(stderr)) !== null) {
        const end = parseFloat(m[1]);
        const duration = parseFloat(m[2]);
        const start = starts[i] ?? end - duration;
        spans.push({ start, end, duration });
        i += 1;
      }
      resolve(spans);
    });
  });
}
