import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const J = "cmtgelq560007j84n3ujx9bpd";
const p = new PrismaClient();
const PORT = new Set(["verb","adjective","adverb","expression"]);
const EN_TANDA = new Set(["work-trips-and-meetings#1","work-trips-and-meetings#2","work-trips-and-meetings#3","local-life-and-routines#1","local-life-and-routines#2","local-life-and-routines#3"]);
(async () => {
  const mio = await p.journey.findUnique({ where: { id: J }, select: { language: true, typeSlug: true } });
  const duro = new Set<string>(); const blando = new Set<string>();
  const otras = await p.journeyStory.findMany({ where: { journey: { language: mio!.language, status: { not: "archived" } }, journeyId: { not: J } }, select: { vocab: true, journey: { select: { typeSlug: true, levels: true } } } });
  for (const r of otras) for (const v of ((r.vocab as any[]) ?? [])) {
    if (!v?.word || PORT.has(String(v.type ?? "").toLowerCase())) continue;
    const mt = r.journey?.typeSlug === mio!.typeSlug;
    const mn = (r.journey?.levels ?? []).some((l: any) => String(l).toLowerCase() === "a2");
    if (mt && !mn) continue;
    (mt ? duro : blando).add(String(v.word));
  }
  const propias = await p.journeyStory.findMany({ where: { journeyId: J }, select: { topic: true, slotIndex: true, vocab: true } });
  for (const r of propias) { if (EN_TANDA.has(`${r.topic}#${r.slotIndex}`)) continue; for (const v of ((r.vocab as any[]) ?? [])) if (v?.word) duro.add(String(v.word)); }
  for (const w of process.argv.slice(2)) console.log(`${duro.has(w) ? "DURO  " : blando.has(w) ? "blando" : "LIBRE "}  ${w}`);
  await p.$disconnect();
})();
