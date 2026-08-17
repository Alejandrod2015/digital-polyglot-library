import { config } from "dotenv";
config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const sets = await p.storyPracticeSet.findMany({
    where: { story: { status: "published", journey: { status: { notIn: ["archived", "draft"] } } } },
    select: {
      story: { select: { slug: true, journey: { select: { name: true, language: true } } } },
      exercises: { select: { type: true, word: true, sentence: true, payload: true } },
    },
  });
  const picks: { lang: string; journey: string; type: string; sentence: string; url: string }[] = [];
  const wantLangs = new Set(["german", "spanish"]);
  const perLang: Record<string, number> = {};
  for (const s of sets) {
    const lang = s.story?.journey?.language ?? "?";
    const journey = s.story?.journey?.name ?? "?";
    for (const ex of s.exercises) {
      if (ex.type !== "fill_blank" && ex.type !== "meaning_in_context") continue;
      const ac = (ex.payload as Record<string, unknown> | null)?.audioClip as Record<string, unknown> | undefined;
      const url = typeof ac?.clipUrl === "string" ? ac.clipUrl : "";
      const sent = typeof ac?.sentence === "string" ? ac.sentence : ex.sentence ?? "";
      if (!url || !sent) continue;
      if (!wantLangs.has(lang)) continue;
      if ((perLang[lang] || 0) >= 3) continue;
      perLang[lang] = (perLang[lang] || 0) + 1;
      picks.push({ lang, journey, type: ex.type, sentence: sent, url });
    }
  }
  for (const p of picks) console.log(`${p.lang}\t${p.journey}\t${p.sentence}\t${p.url}`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
