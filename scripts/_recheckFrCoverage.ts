// Encargo de planificacion: re-corre checkMasterCoverage (arreglada, 85aa284a)
// sobre las 42 historias de FR A2 y FR B1 Friends. Solo lectura: no toca la
// base ni ElevenLabs. Descarga cada master a un tmp, lo borra al terminar.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { checkMasterCoverage } from "./coverageWhisperCheck";

const p = new PrismaClient();

const JOURNEYS = [
  { label: "FR A2", id: "cmu04ereh000732z7px7naqa2" },
  { label: "FR B1", id: "cmu0doigc0007j8e292tycths" },
];

async function main() {
  for (const j of JOURNEYS) {
    const stories = await p.journeyStory.findMany({
      where: { journeyId: j.id },
      orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
      select: { id: true, title: true, slug: true, text: true, audioUrl: true, topic: true, slotIndex: true },
    });
    console.log(`\n=== ${j.label} (${j.id}), ${stories.length} historias ===`);
    for (const s of stories) {
      if (!s.audioUrl || !s.text) {
        console.log(`SKIP ${s.title ?? s.slug}: sin audioUrl o sin text`);
        continue;
      }
      const t0 = Date.now();
      let result;
      let err: string | null = null;
      try {
        result = await checkMasterCoverage(s.audioUrl, s.text);
      } catch (e) {
        err = e instanceof Error ? e.message : String(e);
      }
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (err) {
        console.log(`ERROR ${s.title ?? s.slug} (${secs}s): ${err}`);
        continue;
      }
      console.log(`--- ${j.label} | topic ${s.topic} slot ${s.slotIndex} | ${s.title ?? s.slug} (${secs}s) ---`);
      console.log(`ok=${result!.ok} gaps=${result!.gaps.length} dups=${result!.duplicates.length}`);
      for (const g of result!.gaps) {
        console.log(`  GAP: "${g.textWords.join(" ")}"`);
      }
      for (const d of result!.duplicates) {
        console.log(`  DUP: "${d.words.join(" ")}" heardCount=${d.heardCount} textCount=${d.textCount}`);
      }
    }
  }
  await p.$disconnect();
}

main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
