// ¿Quedó algún par del match sin clip? Solo lee.
import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
type MP = { pairs?: Array<{ word?: string; wordClipUrl?: string | null; wordVoiceId?: string | null }> };
(async () => {
  const js = await p.journey.findMany({
    where: { status: { notIn: ["archived", "draft"] } },
    select: { id: true, name: true, language: true, variant: true },
  });
  let faltan = 0;
  for (const j of js) {
    const ejs = await p.storyPracticeExercise.findMany({
      where: { type: "match_meaning", set: { story: { journeyId: j.id } } },
      select: { payload: true },
    });
    const pares = ejs.flatMap((e) => (e.payload as MP).pairs ?? []);
    const con = pares.filter((x) => x.wordClipUrl).length;
    const voces = new Set(pares.map((x) => x.wordVoiceId ?? "(sin voz)"));
    faltan += pares.length - con;
    console.log(
      `${(j.language + "/" + j.variant + " · " + j.name).padEnd(36)} ${String(con).padStart(3)}/${String(pares.length).padStart(3)} pares con clip · voces: ${[...voces].map((v) => v.slice(0, 8)).join(", ")}`
    );
  }
  console.log(faltan === 0 ? "\n✓ ningún par sin clip" : `\n✗ ${faltan} pares sin clip`);
})().finally(() => p.$disconnect());
