import * as fs from "fs";
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const PORT = new Set(["verb","adjective","adverb","expression"]);
const CORTE=15;
const dic = JSON.parse(fs.readFileSync("scripts/_itA1/portables.json","utf8")) as any;
const st = (JSON.parse(fs.readFileSync("scripts/_itA1/ALL.json","utf8")) as any[])
  .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]) as string[];
const cuerpos=st.map(s=>new Set(tok(s.text)));
const formas=(v:any)=>{const w=String(v.word).toLowerCase();const r=w.replace(/[oaei]$/,"");
  return [...new Set([...(dic[w]?.forms??[]),String(v.surface??v.word).toLowerCase(),w,r+"o",r+"a",r+"i",r+"e"])];};
const veces=(w:string)=>st.reduce((n,s)=>n+s.vocab.filter((v:any)=>String(v.word).toLowerCase()===w).length,0);
const techo=(s:any)=>Math.max(25,Math.round(String(s.text).trim().split(/\s+/).length/9));
console.log("plazas 1-15:", st.slice(0,CORTE).map(s=>`${s.vocab.length}/${techo(s)}`).join(" "));
for (let i=CORTE;i<st.length;i++) for (const v of st[i].vocab) {
  if (!PORT.has(v.type)) continue;
  if (veces(String(v.word).toLowerCase())>1) { console.log(`  ${i+1} ${v.word}: ya reciclada`); continue; }
  const donde = st.slice(0,CORTE).map((d,k)=>k).filter(k=>formas(v).some(f=>cuerpos[k].has(f)));
  console.log(`  ${i+1} ${String(v.word).padEnd(14)} formas=[${formas(v).slice(0,4).join(",")}] cabe en historias ${donde.map(k=>k+1).join(",") || "NINGUNA"}`);
}
