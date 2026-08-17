import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { APPROVED_VOICES } from "../src/lib/approvedVoices";
import { voiceEngine } from "../src/lib/audioEngine";

const prisma = new PrismaClient();
const isApproved = (v: string) => Object.prototype.hasOwnProperty.call(APPROVED_VOICES, v.trim());

async function main() {
  const stories = await prisma.journeyStory.findMany({
    select: {
      slug: true, status: true, voiceId: true,
      journey: { select: { name: true, language: true, variant: true, status: true } },
      practiceSet: { select: { exercises: { select: { payload: true } } } },
    },
  });

  // voiceId -> occurrences {journey, lang, jstatus, slug, sstatus, field}
  const map = new Map<string, { journeys: Set<string>; slugs: Set<string>; fields: Set<string>; count: number }>();
  const add = (v: string | null | undefined, ctx: { j: string; lang: string; slug: string; field: string }) => {
    const vid = (v ?? "").trim();
    if (!vid) return;
    if (voiceEngine(vid) !== "elevenlabs") return; // solo EL (A deja sonar EL)
    if (isApproved(vid)) return;                    // solo NO aprobadas
    if (!map.has(vid)) map.set(vid, { journeys: new Set(), slugs: new Set(), fields: new Set(), count: 0 });
    const e = map.get(vid)!;
    e.journeys.add(`${ctx.j} (${ctx.lang})`);
    e.slugs.add(ctx.slug);
    e.fields.add(ctx.field);
    e.count++;
  };

  for (const s of stories) {
    const j = s.journey?.name ?? "?";
    const lang = s.journey?.language ?? "?";
    add(s.voiceId, { j, lang, slug: s.slug ?? "?", field: `narration(${s.journey?.status}/${s.status})` });
    for (const ex of s.practiceSet?.exercises ?? []) {
      const ac = ((ex.payload as Record<string, unknown> | null)?.audioClip ?? null) as Record<string, unknown> | null;
      add(typeof ac?.voiceId === "string" ? ac.voiceId : null, { j, lang, slug: s.slug ?? "?", field: "practiceClip" });
      add(typeof ac?.wordVoiceId === "string" ? ac.wordVoiceId : null, { j, lang, slug: s.slug ?? "?", field: "practiceWord" });
    }
  }

  console.log(`\n=== Voces EL NO APROBADAS (${map.size}); dónde aparecen ===\n`);
  for (const [vid, e] of [...map.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`⚠ ${vid}  (x${e.count}, campos: ${[...e.fields].join(",")})`);
    console.log(`    journeys: ${[...e.journeys].join(" · ")}`);
    console.log(`    historias (${e.slugs.size}): ${[...e.slugs].slice(0, 8).join(", ")}${e.slugs.size > 8 ? " …" : ""}`);
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
