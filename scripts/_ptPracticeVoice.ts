import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const js = await p.journey.findMany({
    where: { status: { notIn: ["archived", "draft"] } },
    select: { id: true, name: true, language: true, variant: true },
  });
  for (const j of js) {
    const s = await p.journeyStory.findMany({
      where: { journeyId: j.id, status: "published" },
      select: { practiceVoiceId: true, voiceId: true },
    });
    const pv = new Set(s.map((x) => x.practiceVoiceId ?? "(null)"));
    const nv = new Set(s.map((x) => x.voiceId ?? "(null)"));
    console.log(`${(j.language + "/" + j.variant).padEnd(22)} voz práctica: ${[...pv].join(", ").padEnd(28)} voz narrador: ${[...nv].join(", ")}`);
  }
}
main().finally(() => p.$disconnect());
