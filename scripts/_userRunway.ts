import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const userId = process.argv[2];

async function run() {
  const evs = await prisma.userMetric.findMany({
    where: { userId },
    select: { storySlug: true, eventType: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const slugs = [...new Set(evs.map((e) => e.storySlug))];
  const opened = new Set(evs.filter((e) => e.eventType === "story_opened").map((e) => e.storySlug));
  const finished = new Set(evs.filter((e) => e.eventType === "audio_complete").map((e) => e.storySlug));

  const stories = await prisma.journeyStory.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true, title: true, status: true, journeyId: true, slotIndex: true },
  });
  const journeyIds = [...new Set(stories.map((s) => s.journeyId).filter(Boolean))] as string[];

  for (const jid of journeyIds) {
    const j = await prisma.journey.findUnique({ where: { id: jid } });
    const all = await prisma.journeyStory.findMany({
      where: { journeyId: jid },
      select: { slug: true, title: true, status: true, slotIndex: true, topic: true, audioUrl: true },
      orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    });
    const a = j as unknown as Record<string, unknown>;
    console.log(`\n===== JOURNEY ${jid} =====`);
    console.log({ title: a.title, slug: a.slug, status: a.status, language: a.languageId, level: a.levelId, variant: a.variant });
    const pub = all.filter((s) => s.status === "published");
    console.log(`historias: ${all.length} totales · ${pub.length} publicadas`);
    let n = 0;
    for (const s of all) {
      const mark = finished.has(s.slug) ? "TERMINADA" : opened.has(s.slug) ? "abierta  " : "         ";
      if (finished.has(s.slug)) n++;
      console.log(`  ${String(s.slotIndex ?? "-").padStart(3)} [${s.status === "published" ? "pub" : s.status.slice(0, 3)}] ${mark} ${(s.topic ?? "-").padEnd(22)} ${s.slug}${s.audioUrl ? "" : "  (SIN AUDIO)"}`);
    }
    const restantes = pub.filter((s) => !finished.has(s.slug)).length;
    console.log(`  → terminadas por él: ${n} · publicadas restantes: ${restantes}`);
  }

  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
