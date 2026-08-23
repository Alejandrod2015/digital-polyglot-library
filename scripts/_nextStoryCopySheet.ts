// Lee de corrido todos los textos posibles del aviso, como los veria un alumno.
import { getJourneyOrders, nextStoryCopy, topicOrderIndex } from "../src/lib/nextStoryPush";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const orders = await getJourneyOrders();
  const topics = new Map((await p.topic.findMany({ select: { slug: true, label: true } })).map(t => [t.slug.toLowerCase(), t.label]));
  for (const j of orders.values()) {
    console.log(`\n=== ${j.label} (${j.language})`);
    j.stories.forEach((from, i) => {
      const next = j.stories[i + 1];
      if (!next) return;
      const left = j.stories.filter(s => s.topic === next.topic && s.slotIndex >= next.slotIndex).length;
      const c = nextStoryCopy({ toTitle: next.title, topicLabel: topics.get(next.topic.toLowerCase()) ?? null, newTopic: next.topic !== from.topic, leftInTopic: left, position: i + 2, topicIndex: topicOrderIndex(j, next.topic) });
      console.log(`  ${c.title}`);
      console.log(`  ${c.body}`);
    });
  }
})().finally(() => p.$disconnect());
