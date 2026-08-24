/** Tabla de un journey EN CONSTRUCCION: etapas del pipeline por tema, nunca
 *  metadata de autoria ([[feedback_journey_status_table]]). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __r = createRequire(__filename);
try { const q = __r.resolve("server-only"); (__r as unknown as { cache: Record<string, unknown> }).cache[q] = { id: q, filename: q, loaded: true, exports: {} }; } catch {}
import { PrismaClient } from "../../src/generated/prisma";
import { getTapGlossesForSlug } from "../../src/lib/tapGlosses";
const p = new PrismaClient();
const J = "cmt70xfyt000l3283gxd70wck";
const TAPPABLE = /\p{L}+(?:-\p{L}+)*/gu;
(async () => {
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true, status: true, levels: true } });
  const st = await p.journeyStory.findMany({
    where: { journeyId: J },
    select: { id: true, slug: true, title: true, topic: true, slotIndex: true, text: true, vocab: true, audioUrl: true, coverUrl: true, status: true },
  });
  const labels = Object.fromEntries((await p.topic.findMany({ where: { slug: { in: j!.topics } }, select: { slug: true, label: true } })).map((t) => [t.slug, t.label]));
  const sets = await p.storyPracticeSet.findMany({
    where: { story: { journeyId: J } },
    select: { storyId: true, exercises: { select: { payload: true } } },
  });
  const porSet = new Map(sets.map((s) => [s.storyId, s.exercises]));
  console.log(`| # | Tema | Escritas + vocab | Glosas tap | Práctica | Audio | Portada |`);
  console.log(`|---|---|---|---|---|---|---|`);
  let T = [0, 0, 0, 0, 0];
  for (const [i, slug] of j!.topics.entries()) {
    const ss = st.filter((s) => s.topic === slug).sort((a, b) => a.slotIndex - b.slotIndex);
    const escritas = ss.filter((s) => (s.text ?? "").trim().length > 50 && ((s.vocab as unknown[]) ?? []).length >= 20).length;
    let glosas = 0;
    for (const s of ss) {
      const g = getTapGlossesForSlug(s.slug!);
      if (!g) continue;
      const faltan = [...`${s.title} ${s.text}`.matchAll(TAPPABLE)].filter((m) => !g[m[0].toLowerCase()]);
      if (faltan.length === 0) glosas++;
    }
    const practica = ss.filter((s) => (porSet.get(s.id) ?? []).length > 0).length;
    const clips = ss.reduce((a, s) => a + (porSet.get(s.id) ?? []).filter((e) => (e.payload as { audioClip?: { clipUrl?: string } })?.audioClip?.clipUrl).length, 0);
    const audio = ss.filter((s) => s.audioUrl).length;
    const cover = ss.filter((s) => s.coverUrl).length;
    T = [T[0] + escritas, T[1] + glosas, T[2] + practica, T[3] + audio, T[4] + cover];
    const ok = (n: number) => (n === 3 ? `3/3 ✅` : `${n}/3`);
    console.log(`| ${i + 1} | ${labels[slug] ?? slug} | ${ok(escritas)} | ${ok(glosas)} | ${ok(practica)}${clips ? ` (${clips} clips)` : " (sin clips)"} | ${audio}/3 | ${cover}/3 |`);
  }
  console.log(`| | **total** | **${T[0]}/21** | **${T[1]}/21** | **${T[2]}/21** | **${T[3]}/21** | **${T[4]}/21** |`);
  console.log(`\nestado ${j!.status} · niveles ${JSON.stringify(j!.levels)} · publicadas ${st.filter((s) => s.status === "published").length}/21`);
})().finally(() => p.$disconnect());
