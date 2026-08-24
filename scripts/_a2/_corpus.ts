import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { isCannedMotivation } from "../../src/lib/betaMotivations";
const p = new PrismaClient();
(async () => {
  const all = await p.betaSignup.findMany({ select: { targetLanguage: true, motivation: true, learningGoal: true, applicationReason: true, email: true } });
  const rows = all.filter((r) => String(r.targetLanguage ?? "").toLowerCase() === "spanish");
  let i = 0;
  for (const r of rows) {
    const who = String(r.email ?? "?").split("@")[0];
    const m = String(r.motivation ?? "").trim();
    if (m && !isCannedMotivation(m)) console.log(`[${++i}] MOT  ${who}: ${m}`);
    const g = String(r.learningGoal ?? "").trim();
    if (g) console.log(`[${++i}] GOAL ${who}: ${g}`);
    const a = String(r.applicationReason ?? "").trim();
    if (a) console.log(`[${++i}] REA  ${who}: ${a}`);
  }
  console.log(`\n${i} frases en el corpus`);
})().finally(() => p.$disconnect());
