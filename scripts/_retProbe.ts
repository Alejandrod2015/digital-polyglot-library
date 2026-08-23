// Prueba el calculo de retencion contra los datos reales, sin pasar por la UI.
import { PrismaClient } from "../src/generated/prisma";
import { buildRetention, SERVER_WRITTEN_METRIC_EVENTS } from "../src/lib/metricsRetention";
const prisma = new PrismaClient();

async function main() {
  const days = Number(process.argv[2] ?? "180");
  const windowStart = new Date(Date.now() - days * 864e5);
  // Aqui las altas salen de la propia tabla (primer evento) en vez de Clerk:
  // es una aproximacion para probar la matematica, no la fuente real.
  const first = await prisma.userMetric.groupBy({
    by: ["userId"],
    _min: { createdAt: true },
  });
  const signups = first
    .map((r) => ({ userId: r.userId, createdAt: r._min.createdAt! }))
    .filter((s) => s.createdAt >= windowStart);
  const activity = await prisma.userMetric.findMany({
    where: {
      userId: { in: signups.map((s) => s.userId) },
      eventType: { notIn: SERVER_WRITTEN_METRIC_EVENTS },
    },
    select: { userId: true, createdAt: true },
  });
  const out = buildRetention({
    signups,
    activity,
    now: new Date(),
    weeks: Math.ceil(days / 7),
  });
  console.log(`altas en ${days}d: ${signups.length} · filas de actividad: ${activity.length}`);
  console.log("semanas:", out.weeks);
  for (const c of out.cohorts) {
    console.log(
      c.weekStart.padEnd(12),
      String(c.users).padStart(3),
      c.weeks.map((w) => `${w.pct}%${w.partial ? "*" : " "}`.padStart(7)).join("")
    );
  }
  console.log("volvieron algun otro dia:", out.overall.returned, "/", out.overall.returnEligible, "=", out.overall.returnedPct + "%");
  for (const m of out.overall.milestones) {
    console.log(`D${m.day}: ${m.retained}/${m.eligible} = ${m.pct === null ? "s/d" : m.pct + "%"}`);
  }
}
main().finally(() => prisma.$disconnect());
