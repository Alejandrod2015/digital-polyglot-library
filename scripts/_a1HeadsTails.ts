import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmovi4cvi000032q37a4823h3";
(async () => {
  const rows = await prisma.journeyStory.findMany({
    where: { journeyId: J, level: "a1" },
    select: { slug: true, topic: true, slotIndex: true, text: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  let cityOpens = 0, abuelaHits = 0;
  for (const r of rows) {
    const lines = (r.text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const open = lines[0] || "";
    const tail = lines.slice(-2).join("  ⟶  ");
    const cityIn1st = /(Colombia|México|Argentina|Perú|Chile),|, (Colombia|México|Argentina|Perú|Chile)/.test(open);
    if (cityIn1st) cityOpens++;
    if (/\babuela\b/i.test(r.text || "")) abuelaHits++;
    console.log(`\n[${r.topic} ${r.slotIndex}] ${r.slug}${cityIn1st ? "  «CITY-OPEN»" : ""}`);
    console.log(`  ▶ ${open}`);
    console.log(`  ◀ ${tail}`);
  }
  console.log(`\n--- ${cityOpens} aperturas con Ciudad/País | ${abuelaHits} historias con la palabra "abuela" ---`);
  await prisma.$disconnect();
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
