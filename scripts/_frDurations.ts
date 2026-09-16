// Solo duracion real (ffprobe, streaming, sin bajar a disco) para completar
// la tabla del informe de cobertura. Solo lectura.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { execFileSync } from "child_process";

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
      select: { title: true, slug: true, audioUrl: true },
    });
    for (const s of stories) {
      if (!s.audioUrl) { console.log(`${j.label}\t${s.title ?? s.slug}\tNA`); continue; }
      try {
        const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", s.audioUrl], { timeout: 30000 });
        console.log(`${j.label}\t${s.title ?? s.slug}\t${parseFloat(out.toString().trim()).toFixed(1)}`);
      } catch (e) {
        console.log(`${j.label}\t${s.title ?? s.slug}\tERROR`);
      }
    }
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
