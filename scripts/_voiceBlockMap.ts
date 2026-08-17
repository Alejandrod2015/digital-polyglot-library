import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmovi4cvi000032q37a4823h3";
(async () => {
  const s = await prisma.journeyStory.findFirst({ where: { journeyId: J, slug: "sin-cumbia-no-hay-fiesta" }, select: { audioWordTimings: true } });
  const payload: any = s?.audioWordTimings;
  if (!payload) { console.log("sin audioWordTimings"); process.exit(1); }
  const pt: string = payload.storyPlainText || "";
  const idx = pt.indexOf("aprendemos nosotros");
  console.log("=== storyPlainText alrededor de 'aprendemos nosotros' ===");
  console.log(JSON.stringify(pt.slice(Math.max(0, idx - 40), idx + 90)));
  const words: any[] = payload.words || [];
  // find tokens around that char index
  console.log("\n=== tokens (text | charStart-charEnd | startSec-endSec) cerca ===");
  for (const w of words) {
    if (w.charEnd >= idx - 20 && w.charStart <= idx + 70) {
      console.log(`  ${String(w.text).padEnd(14)} ch ${w.charStart}-${w.charEnd}   ${w.startSec}-${w.endSec}`);
    }
  }
  await prisma.$disconnect();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
