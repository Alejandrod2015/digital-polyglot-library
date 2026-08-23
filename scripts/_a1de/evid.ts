import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isCannedMotivation, tooShortForEvidence } from "../../src/lib/betaMotivations";
const p = new PrismaClient();
(async () => {
  const all = await p.betaSignup.findMany({ select: { targetLanguage: true, motivation: true, learningGoal: true, applicationReason: true } });
  const rows = all.filter((r) => String(r.targetLanguage ?? "").toLowerCase() === "german");
  let canned = 0; const written: string[] = []; const reasons: string[] = [];
  for (const r of rows) {
    const m = String(r.motivation ?? "").trim();
    if (m) { if (isCannedMotivation(m)) canned++; else written.push(m); }
    const g = String(r.learningGoal ?? "").trim(); if (g) written.push(g);
    const a = String(r.applicationReason ?? "").trim(); if (a) reasons.push(a);
  }
  console.log(`solicitudes german: ${rows.length} · clics del desplegable descartados: ${canned}`);
  console.log(`frases escritas a mano: ${written.length} · applicationReason: ${reasons.length}`);
  for (const t of written.concat(reasons)) console.log("  ·", t.replace(/\s+/g, " ").slice(0, 200));
  // que temas usan ya los otros journeys alemanes
  const js = await p.journey.findMany({ where: { language: "german", status: { not: "archived" } }, select: { name: true, levels: true, variant: true, topics: true, id: true } });
  console.log("\njourneys alemanes vivos y sus temas:");
  for (const j of js) console.log(`  ${j.name} ${j.variant} ${JSON.stringify(j.levels)}  ${j.topics.join(", ")}`);
  await p.$disconnect();
})();
