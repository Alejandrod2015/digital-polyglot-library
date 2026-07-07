import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const fixes = [
    { id: "cmraj8inq000232a62v5jyfy8", slug: "l-ocean-dit-non" },
    { id: "cmraj8iub000432a6upcx7sqb", slug: "grande-plage-petite-peur" },
    { id: "cmraj8ix1000632a6rge4wmnt", slug: "debout-sur-l-ocean" },
  ];
  for (const f of fixes) {
    const r = await prisma.journeyStory.update({ where: { id: f.id },
      data: { status: "published", slug: f.slug } });
    console.log(r.status, r.slug);
  }
})().finally(() => prisma.$disconnect());
