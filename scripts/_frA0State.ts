import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j: any = await p.journey.findUnique({ where: { id: "cmtwo6cys0007j8yzg6ni3fsc" }, select: { status: true, topics: true, typeSlug: true, levels: true } as any });
  const st: any[] = await p.journeyStory.findMany({ where: { journeyId: "cmtwo6cys0007j8yzg6ni3fsc" }, select: { topic: true, slotIndex: true, text: true, title: true, status: true } as any });
  console.log(JSON.stringify(j), "slots", st.length, "con texto", st.filter((s) => s.text).length, "con titulo", st.filter((s) => s.title).length);
  await p.$disconnect();
})();
