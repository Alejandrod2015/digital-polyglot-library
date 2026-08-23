import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
async function main() {
  const t = await p.topic.findMany({ select: { slug: true, label: true, isUniversal: true }, orderBy: { slug: "asc" } });
  console.log(t.length + " temas");
  for (const x of t) console.log(`  ${x.slug.padEnd(32)} ${x.label ?? "-"}${x.isUniversal ? "  [universal]" : ""}`);
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
