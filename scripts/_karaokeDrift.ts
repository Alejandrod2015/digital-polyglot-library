/**
 * Cuánto se ha desviado el texto de una historia respecto del audio que ya
 * tiene. Mira las dos huellas que deja una edición posterior al render:
 *
 *  - `audioWordTimings.words[].charStart/charEnd` dejan de caer sobre su
 *    palabra (el karaoke resalta la palabra equivocada);
 *  - `audioSegments[].text` guarda oraciones que ya no están en el cuerpo.
 *
 * Solo lectura.
 *
 *   npx tsx scripts/_karaokeDrift.ts <journeyId>
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const canon = (v: string) => v.replace(/[«»„“”"'‘’]/g, "");

async function main() {
  const journeyId = process.argv[2];
  const st = await p.journeyStory.findMany({
    where: { journeyId },
    select: { slug: true, text: true, audioUrl: true, audioSegments: true, audioWordTimings: true, updatedAt: true },
    orderBy: { topic: "asc" },
  });
  let totalWords = 0, totalBad = 0;
  for (const s of st) {
    const body = String(s.text ?? "");
    const wt = s.audioWordTimings as { words?: Array<{ text: string; charStart: number; charEnd: number }> } | null;
    const words = wt?.words ?? [];
    const bad = words.filter((w) => body.slice(w.charStart, w.charEnd) !== w.text);
    const segs = (s.audioSegments ?? []) as Array<{ text?: string }>;
    const orphan = Array.isArray(segs)
      ? segs.filter((x) => typeof x.text === "string" && !canon(body).includes(canon(x.text))).length
      : 0;
    totalWords += words.length; totalBad += bad.length;
    // La primera palabra mal colocada dice DÓNDE empieza el desfase.
    const firstBad = bad[0];
    const where = firstBad
      ? `desde "${firstBad.text}" (char ${firstBad.charStart}, el cuerpo dice "${body.slice(firstBad.charStart, firstBad.charEnd)}")`
      : "";
    if (bad.length || orphan) {
      console.log(`${s.slug}: ${bad.length}/${words.length} palabras, ${orphan}/${Array.isArray(segs) ? segs.length : 0} segmentos huérfanos ${where}`);
    }
  }
  console.log(`\n${st.length} historias · ${totalBad}/${totalWords} palabras desalineadas`);
  await p.$disconnect();
}
main();
