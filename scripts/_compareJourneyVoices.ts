import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { isVoiceApproved, APPROVED_VOICES } from "../src/lib/approvedVoices";
const prisma = new PrismaClient();

async function run() {
  for (const jid of process.argv.slice(2)) {
    const j = await prisma.journey.findUnique({ where: { id: jid } });
    const a = j as unknown as Record<string, unknown>;
    const st = await prisma.journeyStory.findMany({
      where: { journeyId: jid },
      select: { slug: true, voiceId: true, dialogueSpec: true },
    });
    const byVoice = new Map<string, Set<string>>();
    let withSpec = 0;
    for (const s of st) {
      const spec = (s.dialogueSpec as { voice?: string; speaker?: string }[] | null) ?? [];
      if (spec.length) withSpec++;
      for (const seg of spec) {
        if (!seg.voice) continue;
        if (!byVoice.has(seg.voice)) byVoice.set(seg.voice, new Set());
        byVoice.get(seg.voice)!.add(seg.speaker ?? "?");
      }
    }
    console.log(`\n===== ${a.name} · ${a.language}/${a.variant} · ${JSON.stringify(a.levels)} · ${a.status} =====`);
    console.log(`historias=${st.length}  con dialogueSpec=${withSpec}  voces distintas=${byVoice.size}`);
    for (const [v, speakers] of [...byVoice].sort((x, y) => y[1].size - x[1].size)) {
      const note = APPROVED_VOICES[v]?.note ?? "";
      console.log(`  ${v}  ${(isVoiceApproved(v) ? "APROBADA" : "NO-APROBADA").padEnd(12)} ${note.slice(0, 60).padEnd(60)} papeles: ${[...speakers].slice(0, 8).join(", ")}`);
    }
  }
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
