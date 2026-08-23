/** De donde viene cada portable que enseño: del A0 Traveler, del Friends, o libre. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const PORT = new Set(["verb","adjective","adverb","expression"]);
async function run(){
  const trav="cmss0fkc40007j8dub1zpa1kc", fr="cmrsiz1n40000320d6h8p8f5g";
  const rows = await prisma.journeyStory.findMany({ where: { journeyId: { in: [trav, fr] } }, select: { journeyId:true, vocab:true } });
  const T=new Set<string>(), F=new Set<string>(), TP=new Set<string>(), FP=new Set<string>();
  for (const r of rows) for (const v of ((r.vocab as any[])??[])) {
    const w=String(v.word).toLowerCase(), p=PORT.has(String(v.type??"").toLowerCase());
    if (r.journeyId===trav) { T.add(w); if(p) TP.add(w); } else { F.add(w); if(p) FP.add(w); }
  }
  console.log(`portables: Traveler A0 ${TP.size} · Friends A0 ${FP.size} · solo Traveler ${[...TP].filter(w=>!FP.has(w)).length} · solo Friends ${[...FP].filter(w=>!TP.has(w)).length}`);
  const st = JSON.parse(fs.readFileSync("scripts/_itA1/ALL.json","utf8")) as any[];
  const mios = st.flatMap(s=>s.vocab.filter((v:any)=>PORT.has(v.type)).map((v:any)=>String(v.word).toLowerCase()));
  const soloFriends = mios.filter(w=>F.has(w)&&!T.has(w));
  const ambos = mios.filter(w=>F.has(w)&&T.has(w));
  console.log(`mis portables ${mios.length} · los ensena tambien Friends A0: ${new Set(mios.filter(w=>F.has(w))).size}`);
  console.log(`  solo Friends (evitables cambiando de palabra): ${[...new Set(soloFriends)].join(" ")}`);
  console.log(`  en los DOS A0 (inevitables si quiero esa palabra): ${[...new Set(ambos)].length} -> ${[...new Set(ambos)].slice(0,40).join(" ")}`);
  await prisma.$disconnect();
}
run();
