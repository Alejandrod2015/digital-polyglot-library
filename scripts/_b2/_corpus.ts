import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isCannedMotivation } from "../../src/lib/betaMotivations";
const p = new PrismaClient();
(async () => {
  const all = await p.betaSignup.findMany({ select: { targetLanguage: true, motivation: true, learningGoal: true, applicationReason: true, currentLevel: true } });
  const rows = all.filter((r) => String(r.targetLanguage ?? "").toLowerCase() === "spanish");
  console.log("solicitudes spanish:", rows.length);
  for (const r of rows) {
    const m = String(r.motivation ?? "").trim();
    const g = String(r.learningGoal ?? "").trim();
    const a = String(r.applicationReason ?? "").trim();
    const parts: string[] = [];
    if (m && !isCannedMotivation(m)) parts.push(`M: ${m}`);
    if (g) parts.push(`G: ${g}`);
    if (a) parts.push(`R: ${a}`);
    if (parts.length) console.log(`[${r.currentLevel ?? "?"}] ${parts.join(" | ")}`);
  }
  await p.$disconnect();
})();
