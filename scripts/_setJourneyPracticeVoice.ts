import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const JHENNY = "FXGrCtY3PEyfqczBAlqm";
// The 3 pilots keep their user-approved andreti practice audio; never touch.
const KEEP = new Set(["la-promesa-del-mole", "humo-en-la-cocina", "tacos-para-todos"]);
(async () => {
  const slugs = JSON.parse(readFileSync("scripts/_authoring.json", "utf8"))
    .map((s: any) => s.slug).filter((s: string) => !KEEP.has(s));
  const r = await prisma.journeyStory.updateMany({
    where: { slug: { in: slugs } },
    data: { practiceVoiceId: JHENNY },
  });
  console.log(`practiceVoiceId=Jhenny set on ${r.count}/${slugs.length} stories (pilots excluded)`);
})().finally(() => prisma.$disconnect());
