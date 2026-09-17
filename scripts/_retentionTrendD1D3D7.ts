import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { buildRetention, SERVER_WRITTEN_METRIC_EVENTS } from "../src/lib/metricsRetention";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

async function main() {
  const WINDOW_DAYS = 45;
  const now = Date.now();
  const windowStart = new Date(now - WINDOW_DAYS * 86400000);

  const rows = await prisma.userMetric.findMany({
    where: { eventType: { notIn: SERVER_WRITTEN_METRIC_EVENTS } },
    select: { userId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 500000,
  });

  const firstSeen = new Map<string, Date>();
  for (const r of rows) {
    if (!firstSeen.has(r.userId)) firstSeen.set(r.userId, r.createdAt);
  }

  const retentionSignups = [...firstSeen.entries()]
    .filter(([, createdAt]) => createdAt >= windowStart)
    .map(([userId, createdAt]) => ({ userId, createdAt }));

  const retentionDaily = buildRetention({
    signups: retentionSignups,
    activity: rows,
    now: new Date(now),
    buckets: WINDOW_DAYS,
    bucketDays: 1,
  });

  const daily = retentionDaily.cohorts
    .map((c) => ({
      date: c.start,
      users: c.users,
      d1: c.cells[1] && !c.cells[1].partial ? c.cells[1].pct : null,
      d3: c.cells[3] && !c.cells[3].partial ? c.cells[3].pct : null,
      d7: c.cells[7] && !c.cells[7].partial ? c.cells[7].pct : null,
      d1r: c.cells[1] && !c.cells[1].partial ? c.cells[1].retained : null,
      d3r: c.cells[3] && !c.cells[3].partial ? c.cells[3].retained : null,
      d7r: c.cells[7] && !c.cells[7].partial ? c.cells[7].retained : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Cohortes diarias de 1-7 personas hacen que el % salte entre 0 y 100 de un
  // dia a otro. Se agrega por semana ISO (lunes) sumando retenidos/elegibles
  // en vez de promediar porcentajes, para que una semana con una cohorte de
  // 1 no pese igual que una de 7.
  function mondayOf(iso: string): string {
    const d = new Date(iso + "T00:00:00Z");
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - (day - 1));
    return d.toISOString().slice(0, 10);
  }

  type Week = { week: string; users: number; d1u: number; d1r: number; d3u: number; d3r: number; d7u: number; d7r: number };
  const weeks = new Map<string, Week>();
  for (const row of daily) {
    const week = mondayOf(row.date);
    const w = weeks.get(week) ?? { week, users: 0, d1u: 0, d1r: 0, d3u: 0, d3r: 0, d7u: 0, d7r: 0 };
    w.users += row.users;
    if (row.d1 !== null) { w.d1u += row.users; w.d1r += row.d1r ?? 0; }
    if (row.d3 !== null) { w.d3u += row.users; w.d3r += row.d3r ?? 0; }
    if (row.d7 !== null) { w.d7u += row.users; w.d7r += row.d7r ?? 0; }
    weeks.set(week, w);
  }

  const weeklySeries = [...weeks.values()]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((w) => ({
      week: w.week,
      users: w.users,
      d1: w.d1u > 0 ? Math.round((w.d1r / w.d1u) * 1000) / 10 : null,
      d3: w.d3u > 0 ? Math.round((w.d3r / w.d3u) * 1000) / 10 : null,
      d7: w.d7u > 0 ? Math.round((w.d7r / w.d7u) * 1000) / 10 : null,
      d1Eligible: w.d1u,
      d3Eligible: w.d3u,
      d7Eligible: w.d7u,
    }));

  writeFileSync(
    "/tmp/retention-d1d3d7.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), windowDays: WINDOW_DAYS, daily, weeklySeries }, null, 2),
  );
  console.log(JSON.stringify({ dailyRows: daily.length, weeks: weeklySeries.length, totalUsers: retentionSignups.length }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
