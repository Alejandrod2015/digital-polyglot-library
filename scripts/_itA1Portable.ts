/** Candidatas PORTABLES que ya viven en los 21 cuerpos y ahora se pueden ensenar. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { isItalianA1A2 } from "../src/lib/cefr/italianA1A2";
const prisma = new PrismaClient();
const PORT = new Set(["verb","adjective","adverb","expression"]);
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
async function run(){
  const st = (JSON.parse(fs.readFileSync("scripts/_itA1/ALL.json","utf8")) as any[])
    .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const tok = (t:string)=>(t.toLowerCase().match(/\p{L}+/gu) ?? []) as string[];
  const cuerpos = st.map(s=>new Set(tok(s.text)));
  const mios = new Set(st.flatMap(s=>s.vocab.map((v:any)=>String(v.word).toLowerCase())));
  const rows = await prisma.journeyStory.findMany({
    where: { journey: { language: "italian", status: { not: "archived" } } },
    select: { vocab: true, journey: { select: { typeSlug: true } } },
  });
  const cand = new Map<string,string>();     // lema -> tipo
  for (const r of rows) for (const v of ((r.vocab as any[])??[])) {
    const t = String(v.type ?? "").toLowerCase();
    if (!PORT.has(t)) continue;
    const w = String(v.word).toLowerCase();
    if (mios.has(w) || !isItalianA1A2(w)) continue;
    cand.set(w, t);
  }
  const stem = (w:string)=>w.slice(0, Math.max(3, w.length-3));
  const out: Array<{w:string,t:string,forma:string,n:number}> = [];
  for (const [w,t] of cand) {
    const r = stem(w);
    const formas = new Map<string,number>();
    cuerpos.forEach(c=>{ for (const x of c) if (x.startsWith(r) && Math.abs(x.length-w.length)<=3) formas.set(x,(formas.get(x)??0)+1); });
    if (!formas.size) continue;
    const [forma,n] = [...formas].sort((a,b)=>b[1]-a[1])[0];
    out.push({w,t,forma,n});
  }
  out.sort((a,b)=>b.n-a.n);
  console.log(`${out.length} portables del A0 que ya estan en mis cuerpos:`);
  for (const x of out) if (x.n>=2) console.log(`  ${String(x.n).padStart(2)} cuerpos  ${x.w.padEnd(14)} ${x.t.padEnd(10)} forma mas comun: ${x.forma}`);
  console.log(`\ncon 1 solo cuerpo: ${out.filter(x=>x.n<2).map(x=>x.w).join(" ")}`);
  await prisma.$disconnect();
}
run();
