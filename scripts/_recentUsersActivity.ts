import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const since = new Date(process.argv[2] || "2026-08-12T00:00:00Z");

async function run() {
  const rows = await prisma.userMetric.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });

  const byUser = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, [] as unknown as typeof rows);
    byUser.get(r.userId)!.push(r);
  }

  // Also: does this user have ANY event before `since`? (distingue usuarios nuevos)
  for (const [userId, evs] of byUser) {
    const older = await prisma.userMetric.count({
      where: { userId, createdAt: { lt: since } },
    });
    const slugs = new Set(evs.map((e) => e.storySlug));
    const books = new Set(evs.map((e) => e.bookSlug).filter(Boolean));
    // máximo progreso por historia
    const maxBySlug = new Map<string, number>();
    for (const e of evs) {
      if (typeof e.value === "number" && Number.isFinite(e.value)) {
        maxBySlug.set(e.storySlug, Math.max(maxBySlug.get(e.storySlug) ?? 0, e.value));
      }
    }
    const totalSec = [...maxBySlug.values()].reduce((a, b) => a + b, 0);
    console.log(
      [
        userId,
        `eventos=${evs.length}`,
        `previos=${older}`,
        `first=${evs[0].createdAt.toISOString()}`,
        `last=${evs[evs.length - 1].createdAt.toISOString()}`,
        `slugs=${slugs.size}`,
        `books=${[...books].join("|") || "-"}`,
        `maxProgressSum=${Math.round(totalSec)}s (${Math.floor(totalSec / 60)}m${Math.round(totalSec % 60)}s)`,
      ].join("  "),
    );
  }
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
