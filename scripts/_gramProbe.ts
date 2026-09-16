import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
import { RE } from "../src/lib/gramProbePatterns";
async function main() {
  for (const id of process.argv.slice(2)) {
    const j = await p.journey.findUnique({ where: { id }, select: { name: true, variant: true, levels: true } });
    const rows = await p.journeyStory.findMany({ where: { journeyId: id, text: { not: null } }, select: { text: true } });
    const t = rows.map((r) => r.text!).join("\n");
    const fr = t.replace(/\n+/g, " ").split(/(?<=[.!?”"])\s+/).filter((f) => f.trim().length > 1).length;
    const out = RE.map(([n, re]) => `${n} ${Math.round((100 * (t.match(re) ?? []).length) / fr)}`).join(" · ");
    console.log(`${(j?.levels ?? []).join("/")} ${j?.name} ${j?.variant} (${fr} or.) -> ${out}`);
  }
  await p.$disconnect();
}
main();
