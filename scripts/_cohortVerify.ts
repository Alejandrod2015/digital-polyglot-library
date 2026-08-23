// Verifica el filtro de cohorte contra la MISMA consulta que hace el
// dashboard: usuarios distintos con evento en el rango.
import { PrismaClient } from "../src/generated/prisma";
import { buildMetricsUserScope, getBetaUserIds } from "../src/lib/metricsCohort";
const prisma = new PrismaClient();

async function main() {
  const from = new Date(Date.now() - 30 * 864e5);
  const to = new Date();
  const internos = ["user_FAKE_INTERNAL"];
  const betaIds = await getBetaUserIds();
  console.log("beta ids (invited/accepted con cuenta):", betaIds.length);

  for (const cohort of ["all", "beta", "public"] as const) {
    const scope = await buildMetricsUserScope(cohort, internos);
    const rows = await prisma.userMetric.findMany({
      where: { ...scope, createdAt: { gte: from, lte: to } },
      distinct: ["userId"],
      select: { userId: true },
    });
    const plays = await prisma.userMetric.count({
      where: { ...scope, createdAt: { gte: from, lte: to }, eventType: "audio_play" },
    });
    console.log(
      cohort.padEnd(7),
      "scope:", JSON.stringify(scope).slice(0, 60),
      "| usuarios:", String(rows.length).padStart(3),
      "| plays:", plays,
    );
  }

  // Cero enlazados no puede significar "todo el mundo".
  const vacio = await buildMetricsUserScope("beta", []);
  console.log("forma con in:[] ->", JSON.stringify({ userId: { in: [] } }),
    "| la real:", JSON.stringify(vacio).slice(0, 40));
  const nada = await prisma.userMetric.count({ where: { userId: { in: [] } } });
  console.log("count con in:[] =", nada, "(debe ser 0)");
}
main().finally(() => process.exit(0));
