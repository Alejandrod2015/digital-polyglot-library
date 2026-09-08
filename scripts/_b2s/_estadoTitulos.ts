import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const jid of ["cmt5x67ze000l320cpgunu5vi", "cmtplpfum0007j8c6piegwt31"]) {
    const j = await p.journey.findUnique({ where: { id: jid }, select: { name: true, language: true, variant: true, levels: true, status: true } });
    console.log("\n=== ", j?.name, j?.language, j?.variant, JSON.stringify(j?.levels), j?.status, jid);
    const st = await p.journeyStory.findMany({ where: { journeyId: jid }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { slotIndex: true, topic: true, slug: true, title: true, audioUrl: true } });
    for (const s of st) console.log(String(s.slotIndex).padStart(2), (s.topic ?? "").padEnd(24), (s.title ?? "").padEnd(28), String(s.title?.length).padStart(2), s.audioUrl ? "AUDIO" : "-", s.slug);
  }
  await p.$disconnect();
})();
