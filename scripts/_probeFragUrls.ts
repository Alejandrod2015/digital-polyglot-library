/** read-only: fragment section URLs + durations vs their span in the master */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.journeyStory.findFirst({
    where: { slug: "diego-pinta-alebrijes" },
    select: { audioFragments: true },
  });
  const frags = (r?.audioFragments as any[]) ?? [];
  for (const f of frags.slice(0, 4)) {
    const span = Number(f.endSec) - Number(f.startSec);
    console.log(`[${f.index}] span_en_master=${span.toFixed(3)}s  url=${String(f.url).split("/").pop()}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
