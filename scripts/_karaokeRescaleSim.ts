// Verifica el reescalado del karaoke sobre timings REALES: para una historia,
// muestrea tiempos reales de audio y compara qué palabra resalta la lógica
// VIEJA (findActiveWordIndex(words, ct)) vs la NUEVA (ct * span/duración).
// "lagWords" = cuántas palabras por detrás va la vieja respecto a la nueva.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { spawnSync } from "node:child_process";
import { resolvePublicMediaUrl } from "../src/lib/publicMedia";

const prisma = new PrismaClient();

type W = { startSec?: number | null; endSec?: number | null };

function findActiveWordIndex(words: W[], t: number): number | null {
  let last: number | null = null;
  for (let i = 0; i < words.length; i += 1) {
    const s = words[i].startSec;
    if (s === null || s === undefined) continue;
    if (t < s) break;
    let nextStart: number | null = null;
    for (let j = i + 1; j < words.length; j += 1) {
      const c = words[j].startSec;
      if (c !== null && c !== undefined && c > s) { nextStart = c; break; }
    }
    if (nextStart === null || t < nextStart) return i;
    last = i;
  }
  return last;
}

function ffprobe(url: string): number | null {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", url], { encoding: "utf8", timeout: 60000 });
  const v = parseFloat((r.stdout || "").trim());
  return Number.isFinite(v) ? v : null;
}

async function main() {
  const slug = process.argv[2] ?? "un-perro-bajo-la-lluvia";
  const s = await prisma.journeyStory.findFirst({
    where: { slug, audioWordTimings: { not: null }, audioUrl: { not: null } },
    select: { slug: true, audioUrl: true, audioWordTimings: true },
  });
  if (!s) { console.log(`no encontrada: ${slug}`); return; }
  const t = s.audioWordTimings as unknown as { words?: W[] };
  const words = (t.words ?? []).filter((w) => typeof w.startSec === "number");
  const span = Math.max(...words.map((w) => (typeof w.endSec === "number" ? w.endSec! : w.startSec!) || 0));
  const dur = ffprobe(resolvePublicMediaUrl(s.audioUrl!) ?? s.audioUrl!) ?? span;
  const factor = span > dur ? Math.min(span / dur, 1.06) : 1;

  console.log(`${slug}  dur=${dur.toFixed(2)}s  span=${span.toFixed(2)}s  factor=${factor.toFixed(5)}  words=${words.length}\n`);
  console.log("  %audio |  t(s)  | oldIdx | newIdx | lagWords | lag(s aprox)");
  for (const pct of [10, 25, 50, 75, 90, 97, 100]) {
    const ct = (dur * pct) / 100;
    const oldIdx = findActiveWordIndex(words, ct);
    const newIdx = findActiveWordIndex(words, ct * factor);
    const lagWords = oldIdx !== null && newIdx !== null ? newIdx - oldIdx : null;
    // lag en segundos ≈ (startSec[newIdx] - startSec[oldIdx])
    const lagSec = oldIdx !== null && newIdx !== null
      ? (Number(words[newIdx].startSec) - Number(words[oldIdx].startSec)) : null;
    console.log(
      `   ${String(pct).padStart(4)} | ${ct.toFixed(2).padStart(6)} | ${String(oldIdx).padStart(6)} | ${String(newIdx).padStart(6)} | ${String(lagWords).padStart(8)} | ${lagSec?.toFixed(2) ?? "-"}`
    );
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
