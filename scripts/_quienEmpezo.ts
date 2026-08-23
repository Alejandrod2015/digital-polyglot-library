import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const A0 = "cmsou2uk0000732mqa4oatcmn";
  const s = await p.journeyStory.findMany({ where: { journeyId: A0 }, select: { slug: true, topic: true, slotIndex: true } });
  const slugs = s.map((x) => x.slug);
  const filas = await p.userMetric.findMany({ where: { storySlug: { in: slugs } }, select: { userId: true, storySlug: true, eventType: true, createdAt: true } });
  const porUser = new Map<string, { ev: number; hist: Set<string>; ult: Date; pri: Date }>();
  for (const f of filas) {
    const u = porUser.get(f.userId) ?? { ev: 0, hist: new Set<string>(), ult: f.createdAt, pri: f.createdAt };
    u.ev++; u.hist.add(f.storySlug);
    if (f.createdAt > u.ult) u.ult = f.createdAt;
    if (f.createdAt < u.pri) u.pri = f.createdAt;
    porUser.set(f.userId, u);
  }
  for (const [u, v] of [...porUser].sort((a, b) => b[1].ev - a[1].ev))
    console.log(`${u} · ${v.ev} eventos · ${v.hist.size}/21 historias · ${v.pri.toISOString().slice(0, 10)} → ${v.ult.toISOString().slice(0, 16)}`);
  await p.$disconnect();
})();
