import fs from 'fs';
const f = process.argv[2];
const d = JSON.parse(fs.readFileSync(f,'utf8'));
for (const s of d) {
  const t: string = s.text;
  const total = t.split(/\s+/).filter(Boolean).length;
  let spoken = 0;
  for (const m of t.matchAll(/“([^”]*)”/g)) spoken += m[1].split(/\s+/).filter(Boolean).length;
  const sent = t.split(/(?<=[.!?])\s+/).map(x=>x.split(/\s+/).filter(Boolean).length).sort((a,b)=>a-b);
  console.log(`${s.slug}: ${total} pal · citado ${(spoken/total*100).toFixed(0)}% · mediana ${sent[Math.floor(sent.length/2)]} · max ${sent[sent.length-1]} · ¶ ${t.split('\n\n').length}`);
}
