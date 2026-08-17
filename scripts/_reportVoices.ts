/**
 * READ-ONLY report: per-journey narration voices, classified as
 * EL-approved / EL-unapproved / non-EL (Piper/Kokoro). No writes.
 */
import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { APPROVED_VOICES } from "../src/lib/approvedVoices";
import { voiceEngine } from "../src/lib/audioEngine";

const prisma = new PrismaClient();

function classify(voiceId: string | null | undefined): string {
  const eng = voiceEngine(voiceId);
  if (eng === "none") return "NONE";
  if (eng !== "elevenlabs") return `NON-EL(${eng})`;
  const approved = !!voiceId && Object.prototype.hasOwnProperty.call(APPROVED_VOICES, voiceId.trim());
  return approved ? "EL-approved" : "EL-UNAPPROVED";
}

async function main() {
  const stories = await prisma.journeyStory.findMany({
    where: { status: "published" },
    select: {
      slug: true,
      voiceId: true,
      practiceVoiceId: true,
      journey: { select: { name: true, language: true, variant: true, status: true } },
    },
  });

  // group by journey
  const byJourney = new Map<string, { lang: string; variant: string; status: string; voices: Map<string, { count: number; cls: string; fields: Set<string> }> }>();
  const allVoices = new Map<string, { cls: string; count: number }>();

  const bump = (m: Map<string, { count: number; cls: string; fields: Set<string> }>, v: string | null | undefined, field: string) => {
    const key = (v ?? "").trim() || "<none>";
    const cls = classify(v);
    if (!m.has(key)) m.set(key, { count: 0, cls, fields: new Set() });
    const e = m.get(key)!;
    e.count++;
    e.fields.add(field);
    if (key !== "<none>") {
      const a = allVoices.get(key) ?? { cls, count: 0 };
      a.count++;
      allVoices.set(key, a);
    }
  };

  for (const s of stories) {
    const jkey = `${s.journey?.name ?? "?"}`;
    if (!byJourney.has(jkey)) {
      byJourney.set(jkey, { lang: s.journey?.language ?? "?", variant: s.journey?.variant ?? "?", status: s.journey?.status ?? "?", voices: new Map() });
    }
    const jr = byJourney.get(jkey)!;
    bump(jr.voices, s.voiceId, "narration");
    if (s.practiceVoiceId) bump(jr.voices, s.practiceVoiceId, "practice");
  }

  console.log(`\n=== PUBLISHED stories: ${stories.length} | journeys: ${byJourney.size} ===\n`);
  const rows: string[] = [];
  for (const [name, jr] of [...byJourney.entries()].sort()) {
    const voiceList = [...jr.voices.entries()]
      .map(([v, e]) => `${e.cls}${e.cls.startsWith("EL-UNAPPROVED") || e.cls.startsWith("NON-EL") ? " ⚠" : ""}: ${v} [${[...e.fields].join("+")}] x${e.count}`)
      .join("  |  ");
    const hasProblem = [...jr.voices.values()].some((e) => e.cls === "EL-UNAPPROVED" || e.cls.startsWith("NON-EL"));
    rows.push(`${hasProblem ? "⚠ " : "  "}${name}  (${jr.lang}/${jr.variant}, ${jr.status})\n     ${voiceList}`);
  }
  console.log(rows.join("\n"));

  console.log(`\n=== DISTINCT VOICES across published (${allVoices.size}) ===`);
  for (const [v, e] of [...allVoices.entries()].sort((a, b) => a[1].cls.localeCompare(b[1].cls))) {
    console.log(`  ${e.cls.padEnd(16)} ${v}  x${e.count}`);
  }

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
