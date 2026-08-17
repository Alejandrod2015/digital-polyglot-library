/** read-only: inspect audio fragment/ambient state for the 4 MX stories */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function main() {
  const slugs = ["diego-pinta-alebrijes","el-mole-poblano","el-mar-es-turquesa","tengo-un-poco-de-miedo"];
  const rows = await prisma.journeyStory.findMany({
    where: { slug: { in: slugs } },
    select: { slug: true, audioUrl: true, audioFragments: true, audioSegments: true,
              audioStatus: true, ambientTag: true, voiceProvenance: true, level: true },
  });
  for (const r of rows) {
    const frags = (r.audioFragments as any[]) ?? null;
    const vp = (r.voiceProvenance as any) ?? {};
    console.log(`\n${r.slug}  status=${r.audioStatus} level=${r.level}`);
    console.log(`  ambientTag = ${JSON.stringify(r.ambientTag)}`);
    console.log(`  audioFragments = ${frags ? frags.length + " fragmentos" : "AUSENTE"}`);
    console.log(`  audioSegments  = ${(r.audioSegments as any[])?.length ?? "null"}`);
    console.log(`  dryUrl presente = ${Boolean(vp?.dryUrl)}   tempo=${vp?.tempo ?? "?"}  keys=${Object.keys(vp).join(",")}`);
    console.log(`  master = ${String(r.audioUrl).split("/").pop()}`);
    if (frags) for (const f of frags) {
      console.log(`    [${f.index}] ${Number(f.startSec).toFixed(2)}-${Number(f.endSec).toFixed(2)}s voice=${f.voiceId} :: ${String(f.text).slice(0, 64)}`);
    }
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
