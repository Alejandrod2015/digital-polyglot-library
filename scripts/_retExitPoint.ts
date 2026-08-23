// Donde se caen: ultimo dia activo de cada usuario reciente y que hacia.
import { PrismaClient } from "../src/generated/prisma";
import { SERVER_WRITTEN_METRIC_EVENTS } from "../src/lib/metricsRetention";
const prisma = new PrismaClient();
const DAY = 86400000;
const di = (d: Date) => Math.floor(d.getTime() / DAY);

async function main() {
  const internal = (process.env.METRICS_EXCLUDE_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const rows = await prisma.userMetric.findMany({
    where: { eventType: { notIn: SERVER_WRITTEN_METRIC_EVENTS }, userId: { notIn: internal.length ? internal : ["__none__"] } },
    select: { userId: true, createdAt: true, eventType: true, storySlug: true },
    orderBy: { createdAt: "asc" },
    take: 200000,
  });
  const byUser = new Map<string, typeof rows>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  const nowDay = di(new Date());

  const evCount = new Map<string, number>();
  const lastEv = new Map<string, number>();
  let opened = 0, played = 0, completed = 0, practiced = 0, total = 0;
  const spans: number[] = [];
  const storiesTouched: number[] = [];

  for (const [u, evs] of byUser) {
    const first = di(evs[0].createdAt);
    if (nowDay - first > 40) continue;
    total++;
    const days = new Set(evs.map(e => di(e.createdAt)));
    spans.push(Math.max(...days) - first + 1);
    const types = new Set(evs.map(e => e.eventType));
    if (types.has("story_opened")) opened++;
    if (types.has("audio_play")) played++;
    if (types.has("audio_complete")) completed++;
    if ([...types].some(t => t.startsWith("practice_"))) practiced++;
    storiesTouched.push(new Set(evs.filter(e => e.storySlug).map(e => e.storySlug)).size);
    for (const e of evs) evCount.set(e.eventType, (evCount.get(e.eventType) ?? 0) + 1);
    const l = evs[evs.length - 1];
    lastEv.set(l.eventType, (lastEv.get(l.eventType) ?? 0) + 1);
  }
  console.log("usuarios (ultimos 40d):", total);
  console.log("abrieron historia:", opened, "| dieron play:", played, "| terminaron una:", completed, "| practica:", practiced);
  console.log("\nhistorias distintas tocadas por usuario:",
    storiesTouched.sort((a,b)=>a-b).join(","));
  console.log("\nultimo evento antes de desaparecer:");
  for (const [t, n] of [...lastEv].sort((a,b)=>b[1]-a[1])) console.log(`  ${t.padEnd(26)} ${n}`);
  console.log("\nvolumen total por evento:");
  for (const [t, n] of [...evCount].sort((a,b)=>b[1]-a[1])) console.log(`  ${t.padEnd(26)} ${n}`);
}
main().finally(() => prisma.$disconnect());
