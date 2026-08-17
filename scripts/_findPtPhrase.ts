import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
type AC = { audioClip?: { clipUrl?: string; sentence?: string } | null };
(async () => {
  const needle = "janela";
  const ejs = await p.storyPracticeExercise.findMany({
    where: { set: { story: { journey: { language: { equals: "portuguese", mode: "insensitive" } } } } },
    select: { type: true, word: true, sentence: true, payload: true, set: { select: { story: { select: { slug: true } } } } },
  });
  const hit = ejs.filter((e) => (e.sentence ?? "").includes(needle) || ((e.payload as AC).audioClip?.sentence ?? "").includes(needle));
  console.log(`ejercicios con "${needle}": ${hit.length}`);
  for (const e of hit.slice(0, 6)) {
    const ac = (e.payload as AC).audioClip;
    console.log(`  [${e.type}] ${e.set?.story?.slug} · palabra "${e.word}"`);
    console.log(`     frase: ${e.sentence}`);
    if (ac?.clipUrl) console.log(`     clip : ${ac.clipUrl.slice(-28)}`);
  }
  // Y en el texto de las historias, por si la frase vive en la narración.
  const st = await p.journeyStory.findMany({
    where: { journey: { language: { equals: "portuguese", mode: "insensitive" } }, status: "published" },
    select: { slug: true, text: true },
  });
  for (const s of st) {
    if (!s.text?.includes(needle)) continue;
    const i = s.text.indexOf(needle);
    console.log(`\n  narración ${s.slug}: …${s.text.slice(Math.max(0, i - 120), i + 120).replace(/\n/g, " ⏎ ")}…`);
  }
})().finally(() => p.$disconnect());
