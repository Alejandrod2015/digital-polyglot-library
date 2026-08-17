import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { applyNarrationPostProcess } from "../src/lib/narrationPostProcess";

const J = "cmqp6hal8000032cb4ywfs0gc";
const SLUGS = ["sabado-de-mercado", "no-hay-cafe", "mateo-trae-pan-dulce", "se-fue-la-luz"];
const BASE = "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/audio/";

(async () => {
  const p = new PrismaClient();
  for (const slug of SLUGS) {
    const s = await p.journeyStory.findFirst({ where: { journeyId: J, slug }, select: { id: true, audioFilename: true, ambientTag: true } });
    if (!s?.audioFilename) { console.log(`!! ${slug}: sin audioFilename`); continue; }
    // derive the DRY multivoice source (strip the _atempo<n>_<ts> suffix added by post-process)
    const dryName = s.audioFilename.replace(/\.mp3$/, "").replace(/_atempo[\d.]+_\d+$/, "") + ".mp3";
    const dryUrl = BASE + dryName;
    const head = await fetch(dryUrl, { method: "HEAD" });
    if (!head.ok) { console.log(`!! ${slug}: dry no existe -> ${dryName} (${head.status})`); continue; }
    const pp = await applyNarrationPostProcess({ storyId: s.id, sourceUrl: dryUrl, tempo: 1.0 }); // ambientTag defaults to story's saved tag
    console.log(`ok ${slug} (${s.ambientTag}): ${pp.audioFilename}`);
  }
  await p.$disconnect();
})().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
