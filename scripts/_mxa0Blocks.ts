import { renderedParagraphs } from '../src/lib/readerParagraphs';
import fs from 'fs';
const d = JSON.parse(fs.readFileSync('scripts/_esA0Mexico/t1.json','utf8'));
for (const s of d) {
  const bl = renderedParagraphs(s.text);
  const pal = s.vocab.map((v:any)=> String(v.surface ?? v.word).toLowerCase());
  console.log(`\n== ${s.title}`);
  bl.forEach((b:string,i:number)=>{
    const n = pal.filter((w:string)=> b.toLowerCase().includes(w)).length;
    console.log(`  [${i}] ${n} vocab · ${b.slice(0,90)}`);
  });
}
