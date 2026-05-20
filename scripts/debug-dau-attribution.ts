// Lista quiénes son los DAU de las últimas 24h y los WAU de los
// últimos 7 días, con sus emails de Clerk. Sirve para validar que
// el filtro `excludeInternal` deja fuera al equipo.

import { createClerkClient } from "@clerk/backend";
import { prisma } from "@/lib/prisma";
import { getInternalUserIds } from "@/lib/metricsAccess";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function listForRange(label: string, hoursAgo: number) {
  const from = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  const rows = await prisma.userMetric.findMany({
    where: { createdAt: { gte: from } },
    distinct: ["userId"],
    select: { userId: true },
  });
  const ids = rows.map((r) => r.userId);
  console.log(`\n== ${label}: ${ids.length} userIds (sin filtro) ==`);
  for (const id of ids) {
    let label = "—";
    try {
      const u = await clerk.users.getUser(id);
      label = u.emailAddresses[0]?.emailAddress ?? "(sin email)";
    } catch {
      label = "(Clerk 404 — userId huerfano)";
    }
    console.log(`  ${id.padEnd(40)} ${label}`);
  }
  return ids;
}

async function main() {
  const dauIds = await listForRange("DAU (24h)", 24);
  const wauIds = await listForRange("WAU (7d)", 24 * 7);

  const internal = await getInternalUserIds();
  console.log(`\n== Internal exclude list (${internal.length} ids) ==`);
  for (const id of internal) console.log(`  ${id}`);

  const dauExternal = dauIds.filter((id) => !internal.includes(id));
  const wauExternal = wauIds.filter((id) => !internal.includes(id));
  console.log(`\n== DAU tras filtro: ${dauExternal.length} ==`);
  for (const id of dauExternal) console.log(`  ${id}`);
  console.log(`\n== WAU tras filtro: ${wauExternal.length} ==`);
  for (const id of wauExternal) console.log(`  ${id}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
