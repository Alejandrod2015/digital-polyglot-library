import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run(){
  const A1="cmt5wqsf7000032ghesowd0jy", A0="cmss0fkc40007j8dub1zpa1kc";
  const st = await prisma.journeyStory.findMany({ where: { journeyId: A1 }, select: { text:true, vocab:true, wordCount:true, vocabCount:true, arcType:true } });
  const a0 = await prisma.journeyStory.findMany({ where: { journeyId: A0 }, select: { vocab:true } });
  const PORT=new Set(["verb","adjective","adverb","expression"]);
  const A0N=new Set<string>(); for(const r of a0) for(const v of ((r.vocab as any[])??[])) if(!PORT.has(String(v.type).toLowerCase())) A0N.add(String(v.word));
  const mios = st.flatMap(s=>((s.vocab as any[])??[]));
  const solape = mios.filter(v=>A0N.has(String(v.word))).length;
  const port = mios.filter(v=>PORT.has(String(v.type).toLowerCase())).length;
  const wc = st.map(s=>s.wordCount!);
  console.log(`historias ${st.length} · plazas ${mios.length} · distintas ${new Set(mios.map(v=>String(v.word))).size}`);
  console.log(`palabras/historia ${Math.min(...wc)}-${Math.max(...wc)} · portables ${(100*port/mios.length).toFixed(0)}%`);
  console.log(`solape con sustantivos anclados del A0: ${solape}`);
  const arcs=new Map<string,number>(); for(const s of st) arcs.set(String(s.arcType),(arcs.get(String(s.arcType))??0)+1);
  console.log("arcos:", [...arcs].map(([k,v])=>`${k} ${v}`).join(" · "));
  await prisma.$disconnect();
}
run();
