import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const prisma = new PrismaClient();
const JID = "cmubidgaf0007j8np6g7n89iu";
const sig = (rows: {type:string;word:string;sentence:string}[]) =>
  rows.map(r=>`${r.type}|${r.word}|${(r.sentence||"").replace(/\s+/g," ").trim()}`).sort().join("\n");
(async () => {
  const st = await prisma.journeyStory.findMany({ where:{journeyId:JID}, select:{id:true,slug:true,topic:true,slotIndex:true}, orderBy:[{topic:"asc"},{slotIndex:"asc"}] });
  const sets = await prisma.storyPracticeSet.findMany({ where:{ storyId:{ in: st.map(s=>s.id) } }, include:{ exercises:true } });
  const byStory = new Map(sets.map(s=>[s.storyId, s]));
  const files = fs.readdirSync("scripts/_sets").filter(f=>f.endsWith(".json"));
  const fileSig = new Map<string,string>();
  const fileRows = new Map<string,any[]>();
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(`scripts/_sets/${f}`,"utf8"));
      const ex = (j.exercises ?? j.items ?? j) as any[];
      if (!Array.isArray(ex)) continue;
      fileRows.set(f, ex);
      fileSig.set(f, sig(ex.map((e:any)=>({type:e.type, word:e.word, sentence:e.sentence}))));
    } catch {}
  }
  for (const s of st) {
    const set = byStory.get(s.id)!;
    const dbSig = sig(set.exercises.map(e=>({type:e.type, word:e.word, sentence:e.sentence})));
    const own = `${s.slug}.json`;
    const match = [...fileSig.entries()].filter(([,v])=>v===dbSig).map(([k])=>k);
    const ownExists = fs.existsSync(`scripts/_sets/${own}`);
    const ownEq = ownExists && fileSig.get(own) === dbSig;
    console.log(`${s.slug}  n=${set.exercises.length}  json=${ownExists ? (ownEq?"OK":"DISTINTO") : "FALTA"}  iguales=[${match.join(", ")}]`);
  }
  await prisma.$disconnect();
})();
