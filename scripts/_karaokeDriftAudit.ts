// Scratch: audita si los timings de karaoke están sincronizados con el audio.
// Compara, por historia: duración real del mp3 (ffprobe) vs. la que asumen los
// timings (audioDurationSec y último endSec). Un desfase grande y uniforme =>
// timings en otra timeline (a3). Sincronizados => el "se atrasa" es el modelo
// de drift acumulado (a1), no un mp3 desincronizado.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { spawnSync } from "node:child_process";
import { resolvePublicMediaUrl } from "../src/lib/publicMedia";

const prisma = new PrismaClient();

function ffprobeDuration(url: string): number | null {
  const r = spawnSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", url,
  ], { encoding: "utf8", timeout: 60000 });
  const v = parseFloat((r.stdout || "").trim());
  return Number.isFinite(v) ? v : null;
}

async function main() {
  const slugFilter = process.argv[2];
  const stories = await prisma.journeyStory.findMany({
    where: {
      audioUrl: { not: null },
      audioWordTimings: { not: null },
      ...(slugFilter ? { slug: { contains: slugFilter } } : {}),
    },
    select: { id: true, slug: true, title: true, audioUrl: true, audioWordTimings: true },
    take: 12,
  });
  console.log(`historias con audio+timings: ${stories.length}\n`);
  for (const s of stories) {
    const t = s.audioWordTimings as unknown as {
      audioDurationSec?: number | null;
      words?: { endSec?: number | null }[];
    } | null;
    const words = Array.isArray(t?.words) ? t!.words! : [];
    const lastEnd = words.length
      ? Math.max(...words.map((w) => (typeof w.endSec === "number" ? w.endSec : 0)))
      : null;
    const assumed = t?.audioDurationSec ?? lastEnd ?? null;
    const url = resolvePublicMediaUrl(s.audioUrl!) ?? s.audioUrl!;
    const real = ffprobeDuration(url);
    const diff = real != null && assumed != null ? real - assumed : null;
    const pct = diff != null && real ? (diff / real) * 100 : null;
    console.log(
      `• ${s.slug}\n  real=${real?.toFixed(2)}s  timings=${assumed?.toFixed(2)}s  ` +
      `lastEnd=${lastEnd?.toFixed(2)}s  audioDurSec=${t?.audioDurationSec ?? "-"}  words=${words.length}\n  ` +
      `diff=${diff?.toFixed(2)}s (${pct?.toFixed(1)}%)  ${pct != null && Math.abs(pct) > 3 ? "⚠️ DESYNC" : "ok"}`
    );
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
