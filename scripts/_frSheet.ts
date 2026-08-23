import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const ORDER = ["home-family","city-getting-around","shopping-money","work-study","food-everyday-life","health-wellbeing","community-celebrations"];
async function main() {
  const st = (await p.journeyStory.findMany({
    where: { journeyId: "cmt09ehi60000320qf9efrypu" },
    select: { slug: true, title: true, topic: true, slotIndex: true, text: true, vocab: true, coverUrl: true, audioUrl: true, voiceId: true, practiceSet: { select: { exercises: { select: { id: true } } } } },
  })).sort((a, b) => (ORDER.indexOf(a.topic) - ORDER.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  console.log("n|historia|slug|palabras|vocab|practica|glosas|portada|voz|audio");
  for (const [i, s] of st.entries()) {
    const set = (s.practiceSet?.exercises ?? []).length;
    console.log([i + 1, s.title, s.slug, String(s.text ?? "").split(/\s+/).length,
      ((s.vocab as unknown[]) ?? []).length, set ? `${set} sembrados` : "-",
      "si", s.coverUrl ? "si" : "-", s.voiceId ? "si" : "-", s.audioUrl ? "si" : "-"].join("|"));
  }
  await p.$disconnect();
}
main();
