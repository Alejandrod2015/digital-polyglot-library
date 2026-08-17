import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { isVoiceApproved } from "../src/lib/approvedVoices";
const prisma = new PrismaClient();

async function run() {
  const st = await prisma.journeyStory.findMany({
    where: { journeyId: "cmqc6tojm000032el2ebwsgkn" },
    select: {
      slug: true, topic: true, slotIndex: true, audioUrl: true, audioStatus: true,
      voiceId: true, practiceVoiceId: true, cast: true, dialogueSpec: true,
      audioQaStatus: true, audioQaScore: true, ambientTag: true, coverUrl: true,
    },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  for (const s of st) {
    const cast = (s.cast as { characters?: unknown[] } | null)?.characters ?? [];
    const dlg = s.dialogueSpec ? "si" : "no";
    const vOk = s.voiceId ? (isVoiceApproved(s.voiceId) ? "APROBADA" : "NO-APROBADA") : "-";
    console.log(
      `${s.slug.padEnd(28)} audio=${s.audioUrl ? "SI" : "no "} st=${(s.audioStatus ?? "-").padEnd(10)} voice=${(s.voiceId ?? "-").padEnd(22)} ${vOk.padEnd(12)} practiceVoice=${(s.practiceVoiceId ?? "-").padEnd(22)} cast=${cast.length} dlgSpec=${dlg} qa=${s.audioQaStatus ?? "-"} ambient=${s.ambientTag ?? "-"}`,
    );
  }
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
