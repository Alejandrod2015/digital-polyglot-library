import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { extractStoryPlainText } from "../../src/lib/storyPlainText";
const p = new PrismaClient();
(async () => {
  const [slug, pat] = process.argv.slice(2);
  const s = await p.journeyStory.findFirst({ where: { slug }, select: { title:true, text:true } });
  const t = `${s!.title}\n${extractStoryPlainText(s!.text ?? "")}`;
  const re = new RegExp(pat, "giu");
  for (const f of t.split(/(?<=[.!?”])\s+/).map(x=>x.trim()).filter(Boolean)) if (re.test(f)) console.log("  " + f);
  await p.$disconnect();
})();
