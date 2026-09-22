import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st: any[] = await p.journeyStory.findMany({ where: { journeyId: "cmud5qhu00006j81cmkl4u5ks" } });
  const slugs = st.map(s=>s.slug);
  const sets = await p.storyPracticeSet.count({ where: { storyId: { in: st.map(s=>s.id) } } });
  console.log("practice sets:", sets);
  const tg = await p.tapGlossSet.findMany({ where: { slug: { in: slugs } }, select: { bundle: true, slug: true } });
  console.log("tapGlossSets:", tg.length);
  const globals = await p.tapGlossSet.findMany({ where: { slug: "" }, select: { bundle: true, language: true, variant: true, slugs: true } });
  for (const g of globals) console.log("BUNDLE", g.bundle, g.language, g.variant, "slugs:", g.slugs.length);
  await p.$disconnect();
})();
