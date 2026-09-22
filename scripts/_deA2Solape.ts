/** Solape de vocab ANCLADO (no portable) del Friends DE A2 contra los Friends DE A0 y A1. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A0 = "cmu047bkz0007326jsgeptkox", A1 = "cmu0dqr6y0007j8o52i1s3gf7", A2 = "cmubidgaf0007j8np6g7n89iu";
const PORT = new Set(["verb","adjective","adverb","expression"]);
const nom = (w: string) => w.replace(/^(der|die|das)\s+/i, "").trim();
(async () => {
  const pub = new Map<string, string>();
  for (const [lvl, id] of [["A0", A0], ["A1", A1]] as const) {
    for (const s of await p.journeyStory.findMany({ where: { journeyId: id }, select: { vocab: true } }))
      for (const v of ((s.vocab as any[]) ?? [])) if (v?.word && !PORT.has(String(v.type ?? "").toLowerCase()))
        if (!pub.has(nom(v.word))) pub.set(nom(v.word), lvl);
  }
  const ORD = ["flats-and-viewings","moving-and-helping-out","second-hand-and-bargains","job-hunting-and-interviews","sports-and-match-days","illness-and-sick-days","housewarming-and-toasts"];
  const st = await p.journeyStory.findMany({ where: { journeyId: A2 }, select: { topic:true, slotIndex:true, slug:true, vocab:true, text:true } });
  st.sort((a,b)=> ORD.indexOf(a.topic!)-ORD.indexOf(b.topic!) || a.slotIndex-b.slotIndex);
  let n = 0;
  for (const s of st) {
    const hits = ((s.vocab as any[]) ?? []).filter((v) => !PORT.has(String(v.type ?? "").toLowerCase()) && pub.has(nom(v.word)));
    if (!hits.length) continue;
    console.log(`\n${s.topic}#${s.slotIndex} ${s.slug}`);
    for (const v of hits) { n++; console.log(`   ${v.word.padEnd(22)} ${pub.get(nom(v.word))}  surface="${v.surface}"`); }
  }
  console.log(`\nTOTAL ${n}`);
  await p.$disconnect();
})();
