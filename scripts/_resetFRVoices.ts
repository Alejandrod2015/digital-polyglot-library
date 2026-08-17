import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const map = [
    { slug: "l-ocean-dit-non", voiceId: "ucMmKRQbfDEYyb2IIGax" },        // Aurore
    { slug: "grande-plage-petite-peur", voiceId: "86fYoxrFeaJKXplThwSl" }, // Julien
    { slug: "debout-sur-l-ocean", voiceId: "ucMmKRQbfDEYyb2IIGax" },     // Aurore
  ];
  for (const m of map) {
    await prisma.journeyStory.updateMany({ where: { slug: m.slug }, data: { voiceId: m.voiceId } });
    console.log(m.slug, "→", m.voiceId);
  }
})().finally(() => prisma.$disconnect());
