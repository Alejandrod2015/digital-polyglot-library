/** SOLO LECTURA: práctica, audio, vocab counts y comparación PT vs journeys ES/DE. */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();

async function main() {
  const journeys = await p.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { id: true, name: true, language: true, variant: true, levels: true, status: true },
  });

  for (const j of journeys) {
    const stories = await p.journeyStory.findMany({
      where: { journeyId: j.id },
      select: { id: true, status: true, text: true, vocab: true, audioUrl: true, coverUrl: true, audioSegments: true, audioWordTimings: true, ambientTag: true },
    });
    const ids = stories.map((s) => s.id);
    const sets = await p.storyPracticeSet.findMany({
      where: { storyId: { in: ids } },
      select: { id: true, storyId: true, exercises: { select: { id: true, type: true, audioUrl: true } } },
    });
    const pub = stories.filter((s) => s.status === "published");
    const words = pub.map((s) => (s.text || "").trim().split(/\s+/).filter(Boolean).length);
    const vocabN = pub.map((s) => (Array.isArray(s.vocab) ? (s.vocab as unknown[]).length : 0));
    const exTotal = sets.reduce((a, s) => a + s.exercises.length, 0);
    const exAudio = sets.reduce((a, s) => a + s.exercises.filter((e) => e.audioUrl).length, 0);
    console.log(
      [
        `${j.status.padEnd(6)} ${j.language}/${j.variant} ${j.name} [${j.levels.join(",")}]`,
        `  hist: ${pub.length}/${stories.length} pub | audio ${pub.filter((s) => s.audioUrl).length} | cover ${pub.filter((s) => s.coverUrl).length} | timings ${pub.filter((s) => s.audioWordTimings).length} | ambient ${pub.filter((s) => s.ambientTag).length}`,
        `  palabras: total ${words.reduce((a, b) => a + b, 0)} avg ${Math.round(words.reduce((a, b) => a + b, 0) / (words.length || 1))} min ${Math.min(...(words.length ? words : [0]))} max ${Math.max(...(words.length ? words : [0]))}`,
        `  vocab: total ${vocabN.reduce((a, b) => a + b, 0)} avg ${Math.round(vocabN.reduce((a, b) => a + b, 0) / (vocabN.length || 1))}`,
        `  practica: sets ${sets.length} | ejercicios ${exTotal} | con audio ${exAudio}`,
      ].join("\n")
    );
  }
}

main().finally(() => p.$disconnect());
