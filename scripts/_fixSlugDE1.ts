import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const r = await prisma.journeyStory.update({
    where: { id: "cmr92f0xa000232ffcv412c5k" },
    data: { slug: "buergeramt-neukoelln-sieben-uhr" },
  });
  console.log("slug:", r.slug);
})().finally(() => prisma.$disconnect());
