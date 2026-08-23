import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: process.argv[2] },
    select: { slug: true, dialogueSpec: true, audioUrl: true, cast: true, voiceProvenance: true, audioFragments: true },
  });
  console.log(`${rows.length} historias · ${rows.filter((r) => r.audioUrl).length} con audio`);
  for (const r of rows.slice(0, 2)) {
    console.log(`\n${r.slug}`);
    console.log("  dialogueSpec:", JSON.stringify(r.dialogueSpec ?? null).slice(0, 200));
    console.log("  cast:", JSON.stringify(r.cast ?? null).slice(0, 200));
    console.log("  provenance:", JSON.stringify(r.voiceProvenance ?? null).slice(0, 200));
    const fr = (r.audioFragments as Array<Record<string, unknown>> | null) ?? [];
    if (fr[0]) console.log("  fragmento0:", JSON.stringify(fr[0]).slice(0, 220));
  }
})().finally(() => p.$disconnect());
