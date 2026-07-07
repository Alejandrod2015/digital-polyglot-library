import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const fixes = [
    { id: "cmr92f19u000832ff22g1ylr0", slug: "bewerbungsgespraech-mit-katze" },
    { id: "cmr92f1cq000a32ffv0j7cy91", slug: "im-keller-wohnt-die-hausordnung" },
    { id: "cmr92f1fn000c32ffgfp24aq4", slug: "umzug-ohne-aufzug" },
  ];
  for (const f of fixes) {
    const r = await prisma.journeyStory.update({ where: { id: f.id },
      data: { status: "published", slug: f.slug } });
    console.log(r.status, r.slug);
  }
})().finally(() => prisma.$disconnect());
