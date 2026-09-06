import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" },
    select: { slug: true, synopsis: true }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  const rojo = /primer(a|os)? (invierno|vez)|por primera vez|descubre|hasta hoy|aprende que|todavía no|nunca había|en verano|de fuera/i;
  for (const s of ss) {
    const m = (s.synopsis ?? "").match(rojo);
    if (m) console.log(`${s.slug.padEnd(30)} [${m[0]}]  ${(s.synopsis ?? "").slice(0, 120)}`);
  }
  await p.$disconnect();
})();
