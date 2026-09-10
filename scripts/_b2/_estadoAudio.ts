import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmtpls1l20007j8epwgcs6e1h" }, select: { status: true, topics: true } });
  const s = await p.journeyStory.findMany({ where: { journeyId: "cmtpls1l20007j8epwgcs6e1h" } });
  const keys = Object.keys(s[0] ?? {}).filter((k) => /voice|audio|narrat|cast/i.test(k));
  console.log("status:", j?.status, "· historias:", s.length, "· con texto:", s.filter((x: any) => (x.text ?? "").trim()).length, "· campos de voz/audio:", keys.join(", "));
  for (const k of keys) console.log(`  ${k}: ${s.filter((x: any) => x[k] != null && JSON.stringify(x[k]) !== "[]" && JSON.stringify(x[k]) !== "{}").length}/21 con valor`);
  await p.$disconnect();
})();
