import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.continueListeningEntry.findMany({
    select: { userId: true, storySlug: true, progressSec: true, updatedAt: true },
  });
  console.log("filas continue-listening:", rows.length, "| usuarios distintos:", new Set(rows.map(r=>r.userId)).size);
  const opened = await prisma.userMetric.groupBy({ by:["userId"], where:{ eventType:"story_opened" }, _count:{_all:true} });
  const played = await prisma.userMetric.groupBy({ by:["userId"], where:{ eventType:"audio_play" }, _count:{_all:true} });
  const vocab = await prisma.userMetric.groupBy({ by:["userId"], where:{ eventType:"vocab_clicked" }, _count:{_all:true} });
  console.log("usuarios que abrieron historia:", opened.length, "| que dieron play:", played.length, "| que tocaron una palabra:", vocab.length);
})().finally(() => process.exit(0));
