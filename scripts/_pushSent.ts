import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.userMetric.groupBy({
    by: ["eventType"],
    where: { eventType: { in: ["resume_story_push_sent","journey_bridge_push_sent","lifecycle_email_sent","reminder_scheduled"] } },
    _count: { _all: true }, _max: { createdAt: true },
  });
  for (const r of rows) console.log(r.eventType.padEnd(26), r._count._all, String(r._max.createdAt).slice(0,16));
  const tok = await prisma.$queryRawUnsafe<any[]>(`select count(*)::int n from "PushToken"`).catch(() => null);
  console.log("push tokens:", tok ? tok[0].n : "(sin tabla PushToken)");
})().finally(() => prisma.$disconnect());
