import { getJourneyOrders } from "../src/lib/nextStoryPush";
(async () => {
  const orders = await getJourneyOrders();
  for (const j of orders.values()) {
    if (!/A0/.test(j.label) || j.language !== "Spanish") continue;
    console.log(`\n== ${j.label} (${j.language}) ${j.stories.length} historias`);
    j.stories.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. [${s.topic} #${s.slotIndex}] ${s.title}`));
  }
})().finally(() => process.exit(0));
