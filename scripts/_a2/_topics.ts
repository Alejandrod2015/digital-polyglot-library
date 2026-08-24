import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const t = await p.topic.findMany({ select: { slug: true, label: true }, orderBy: { slug: "asc" } });
  console.log(t.map((x) => `${x.slug}\t${x.label}`).join("\n"));
  console.log(`\n${t.length} temas`);
})().finally(() => p.$disconnect());
