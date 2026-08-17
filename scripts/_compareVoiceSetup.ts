import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { APPROVED_VOICES, isVoiceApproved } from "../src/lib/approvedVoices";
const prisma = new PrismaClient();

async function run() {
  for (const jid of process.argv.slice(2)) {
    const j = await prisma.journey.findUnique({ where: { id: jid } });
    const a = j as unknown as Record<string, unknown>;
    const st = await prisma.journeyStory.findMany({
      where: { journeyId: jid },
      select: { voiceId: true, practiceVoiceId: true, dialogueSpec: true },
    });
    const narr = new Map<string, number>();
    for (const s of st) {
      const spec = (s.dialogueSpec as { voice?: string }[] | null) ?? [];
      const v = spec[0]?.voice ?? s.voiceId ?? "(ninguna)";
      narr.set(v, (narr.get(v) ?? 0) + 1);
    }
    const prac = new Map<string, number>();
    for (const s of st) {
      const v = s.practiceVoiceId ?? "(hereda del narrador)";
      prac.set(v, (prac.get(v) ?? 0) + 1);
    }
    console.log(`\n===== ${a.name} · ${a.language}/${a.variant} · ${JSON.stringify(a.levels)} · ${a.status} =====`);
    console.log("  NARRACIÓN:");
    for (const [v, n] of narr) console.log(`    ${v}  ${n} historias  ${isVoiceApproved(v) ? "aprobada" : "NO aprobada"}  ${(APPROVED_VOICES[v]?.note ?? "").slice(0, 78)}`);
    console.log("  PRÁCTICA:");
    for (const [v, n] of prac) console.log(`    ${v}  ${n} historias`);
  }
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
