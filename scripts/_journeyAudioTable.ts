import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { APPROVED_VOICES } from "../src/lib/approvedVoices";
import { voiceEngine } from "../src/lib/audioEngine";
const p = new PrismaClient();
const cls = (v: string | null | undefined) => {
  const e = voiceEngine(v);
  if (e === "none") return "-";
  if (e !== "elevenlabs") return `NO-EL(${e})`;
  return v && Object.prototype.hasOwnProperty.call(APPROVED_VOICES, v.trim()) ? "EL-ok" : "EL-noAprob";
};

async function main() {
  const journeys = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: {
      name: true, language: true, variant: true, status: true,
      stories: {
        select: {
          status: true, voiceId: true,
          practiceSet: { select: { exercises: { select: { payload: true } } } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { language: "asc" }, { name: "asc" }],
  });

  console.log("journey | lang/variant | status | #hist(pub) | voces narración | #clips práctica EL");
  for (const j of journeys) {
    const pub = j.stories.filter((s) => s.status === "published");
    const voices = new Map<string, number>();
    let clips = 0;
    for (const s of j.stories) {
      if (s.voiceId) voices.set(s.voiceId, (voices.get(s.voiceId) || 0) + 1);
      for (const ex of s.practiceSet?.exercises ?? []) {
        const ac = (ex.payload as Record<string, unknown> | null)?.audioClip as Record<string, unknown> | undefined;
        if (typeof ac?.clipUrl === "string" && ac.clipUrl) clips++;
      }
    }
    const vstr = [...voices.entries()].map(([v, n]) => `${cls(v)}×${n}`).join(" ") || "-";
    console.log(`${j.name} | ${j.language}/${j.variant} | ${j.status} | ${pub.length}/${j.stories.length} | ${vstr} | ${clips}`);
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
