/** Que plazas caen en cada bloque del lector, oracion a oracion. */
import * as fs from "fs";
import { renderedParagraphs, splitSentences } from "../src/lib/readerParagraphs";
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const st = (JSON.parse(fs.readFileSync("scripts/_itA1/ALL.json","utf8")) as any[])
  .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const solo = process.argv[2];
for (const s of st) {
  if (solo && !s.slug.includes(solo)) continue;
  const bl = renderedParagraphs(s.text);
  const per = bl.map(b=>s.vocab.filter((v:any)=>b.includes(v.surface??v.word)));
  const max = Math.max(...per.map(p=>p.length));
  if (!solo && max/s.vocab.length <= 0.30) continue;
  console.log(`\n### ${s.slug}  ${s.vocab.length} plazas  tope ${Math.floor(0.3*s.vocab.length)}  [${per.map(p=>p.length).join(",")}]`);
  splitSentences(s.text).forEach((f,i)=>{
    const v = s.vocab.filter((x:any)=>f.includes(x.surface??x.word)).map((x:any)=>x.surface??x.word);
    console.log(`  b${Math.floor(i/3)+1} f${i+1} (${String(v.length).padStart(2)}) ${v.join(" ")}`);
  });
}
