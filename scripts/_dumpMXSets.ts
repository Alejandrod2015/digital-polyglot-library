import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const prisma = new PrismaClient();
const JHENNY = "FXGrCtY3PEyfqczBAlqm";
const J = "cmrrqjd2n000032nvnp2tryzg";
(async () => {
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: J },
    select: { slug: true, practiceSet: { select: { exercises: { select: { type: true, word: true, sentence: true, payload: true, featured: true }, orderBy: { orderIndex: "asc" } } } } },
    orderBy: { slotIndex: "asc" },
  });
  for (const s of stories) {
    const exs = (s.practiceSet?.exercises ?? []).map((e) => {
      const p: any = JSON.parse(JSON.stringify(e.payload));
      // ensure practice voice = Jhenny on renderable audioClips
      if (p.audioClip && (e.type === "meaning_in_context" || e.type === "fill_blank")) {
        p.audioClip.voiceId = JHENNY;
      }
      return { type: e.type, word: e.word, sentence: e.sentence, payload: p, featured: e.featured };
    });
    fs.writeFileSync(`scripts/_sets/${s.slug}.json`, JSON.stringify(exs, null, 1));
    const need = exs.filter((e) => e.type === "meaning_in_context" || e.type === "fill_blank").length;
    console.log(`${s.slug}\t${exs.length} ex\t${need} a rendir`);
  }
  await prisma.$disconnect();
})();
