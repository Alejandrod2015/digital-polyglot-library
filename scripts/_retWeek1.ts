// Proxy de la cohorte 2026-07-20 sin Clerk prod: primera senal = alta.
import { PrismaClient } from "../src/generated/prisma";
import { SERVER_WRITTEN_METRIC_EVENTS } from "../src/lib/metricsRetention";
const prisma = new PrismaClient();
const DAY = 86400000;
const di = (d: Date) => Math.floor(d.getTime() / DAY);
const iso = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);
const monday = (n: number) => n - ((n + 3) % 7);

async function main() {
  const internal = (process.env.METRICS_EXCLUDE_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const rows = await prisma.userMetric.findMany({
    where: { eventType: { notIn: SERVER_WRITTEN_METRIC_EVENTS }, userId: { notIn: internal.length ? internal : ["__none__"] } },
    select: { userId: true, createdAt: true },
    take: 200000,
  });
  const days = new Map<string, Set<number>>();
  for (const r of rows) {
    const s = days.get(r.userId) ?? new Set<number>();
    s.add(di(r.createdAt));
    days.set(r.userId, s);
  }
  const nowDay = di(new Date());
  const byWeek = new Map<number, string[]>();
  for (const [u, s] of days) {
    const first = Math.min(...s);
    if (nowDay - first > 40) continue;
    const k = monday(first);
    byWeek.set(k, [...(byWeek.get(k) ?? []), u]);
  }
  for (const [k, users] of [...byWeek].sort((a, b) => a[0] - b[0])) {
    console.log(`\n== semana ${iso(k)}  (${users.length} usuarios)`);
    for (const u of users) {
      const s = [...days.get(u)!].sort((a, b) => a - b);
      const first = s[0];
      const off = s.map(d => d - first);
      console.log(`  ${u.slice(0, 14).padEnd(15)} 1a senal ${iso(first)}  dias activos: ${s.length}  offsets: ${off.join(",")}  ultimo: ${iso(s[s.length - 1])}`);
    }
  }
}
main().finally(() => prisma.$disconnect());
