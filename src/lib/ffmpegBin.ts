// Resolves ffmpeg / ffprobe binary paths so the audio routes work on Vercel,
// where the system PATH has no ffmpeg/ffprobe (that's what caused the
// "spawn ffprobe ENOENT" error in the Studio audio editor). We ship the
// binaries via ffmpeg-static / ffprobe-static and point spawn() at their
// packaged paths. Locally the same packaged binaries work too.
//
// Override with FFMPEG_PATH / FFPROBE_PATH env vars if you need a specific
// system build (e.g. a faster local ffmpeg).
import { chmodSync } from "node:fs";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

function resolveBin(
  envOverride: string | undefined,
  packaged: string | null | undefined,
  systemFallback: string,
): string {
  const path = envOverride || packaged || systemFallback;
  // Vercel's build file-tracing can strip the executable bit when it copies
  // the binary into the function bundle. Re-set it best-effort; on a
  // read-only fs (mode already preserved) this throws and we ignore it.
  try {
    chmodSync(path, 0o755);
  } catch {
    /* already executable or read-only fs — ignore */
  }
  return path;
}

export const FFMPEG_PATH = resolveBin(process.env.FFMPEG_PATH, ffmpegStatic, "ffmpeg");
export const FFPROBE_PATH = resolveBin(
  process.env.FFPROBE_PATH,
  ffprobeStatic.path,
  "ffprobe",
);
