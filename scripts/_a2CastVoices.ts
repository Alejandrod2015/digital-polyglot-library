import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
import { isVoiceApproved } from "../src/lib/approvedVoices";
const prisma = new PrismaClient();

async function run() {
  const st = await prisma.journeyStory.findMany({
    where: { journeyId: "cmqc6tojm000032el2ebwsgkn" },
    select: { slug: true, topic: true, dialogueSpec: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  const byVoice = new Map<string, { speakers: Set<string>; stories: Set<string> }>();
  for (const s of st) {
    const spec = (s.dialogueSpec as { voice?: string; speaker?: string }[] | null) ?? [];
    for (const seg of spec) {
      if (!seg.voice) continue;
      if (!byVoice.has(seg.voice)) byVoice.set(seg.voice, { speakers: new Set(), stories: new Set() });
      const e = byVoice.get(seg.voice)!;
      e.speakers.add(seg.speaker ?? "?");
      e.stories.add(s.slug);
    }
  }
  console.log(`voces distintas en dialogueSpec: ${byVoice.size}\n`);
  const rows = [...byVoice].sort((a, b) => b[1].stories.size - a[1].stories.size);
  for (const [voice, e] of rows) {
    console.log(
      `${voice}  ${(isVoiceApproved(voice) ? "APROBADA" : "NO-APROBADA").padEnd(12)} historias=${String(e.stories.size).padStart(2)}  personajes: ${[...e.speakers].join(", ")}`,
    );
  }
  const bad = rows.filter(([v]) => !isVoiceApproved(v));
  console.log(`\n→ ${bad.length}/${byVoice.size} voces del reparto NO están en la allowlist.`);
  const blocked = new Set<string>();
  for (const [, e] of bad) for (const s of e.stories) blocked.add(s);
  console.log(`→ historias que NO se pueden renderizar hoy: ${blocked.size}/21`);
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
