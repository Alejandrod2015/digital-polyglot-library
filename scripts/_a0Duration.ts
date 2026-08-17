/**
 * Relación palabras <-> segundos en el A0 España, usando las duraciones REALES
 * que la app registró al reproducir sus audios. Sirve para fijar el largo del
 * A1 en la unidad que importa: el minuto que dura la historia.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function run() {
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: "cmrr5hnbl000032k1esry5n8g" },
    select: { slug: true, text: true, wordCount: true },
  });
  const bySlug = new Map(stories.map((s) => [s.slug!, s]));

  const evs = await prisma.userMetric.findMany({
    where: { eventType: "audio_complete", storySlug: { in: [...bySlug.keys()] } },
    select: { storySlug: true, metadata: true },
  });

  const dur = new Map<string, number>();
  for (const e of evs) {
    const m = (e.metadata ?? {}) as Record<string, unknown>;
    const d = typeof m.audioDurationSec === "number" ? m.audioDurationSec : null;
    if (d) dur.set(e.storySlug, d);
  }

  const rows: { slug: string; w: number; d: number }[] = [];
  for (const [slug, d] of dur) {
    const s = bySlug.get(slug);
    if (!s?.text) continue;
    rows.push({ slug, w: s.text.trim().split(/\s+/).length, d });
  }
  rows.sort((a, b) => a.d - b.d);
  for (const r of rows) console.log(`${r.slug.padEnd(30)} ${String(r.w).padStart(3)} palabras · ${r.d}s · ${Math.round((r.w / r.d) * 60)} ppm`);

  const w = rows.reduce((s, r) => s + r.w, 0) / rows.length;
  const d = rows.reduce((s, r) => s + r.d, 0) / rows.length;
  console.log(`\nmedia: ${Math.round(w)} palabras · ${Math.round(d)}s · ${Math.round((w / d) * 60)} palabras por minuto`);
  console.log(`para 60s exactos: ${Math.round((w / d) * 60)} palabras`);
  console.log(`(${rows.length} historias con duración registrada de ${stories.length})`);
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
