import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { readFileSync, writeFileSync } from "fs";
import { uploadPublicObject } from "../src/lib/objectStorage";
const SP = process.argv[2]; const KEY = process.env.ELEVENLABS_API_KEY!;
const sleep=(m:number)=>new Promise(r=>setTimeout(r,m));
async function retry<T>(f:()=>Promise<T>){for(let i=1;i<=4;i++){try{return await f()}catch{await sleep(800*i)}}return null}
(async () => {
  const pool = new Map<string, any>();
  for (const f of ["f_peninsular","p2_female"]) {
    try { for (const v of JSON.parse(readFileSync(`${SP}/${f}.json`,"utf8")).voices ?? []) if(!pool.has(v.name)) pool.set(v.name, v); } catch {}
  }
  const out: any[] = [];
  for (const [code,name] of [["B1","Jenni"],["B2","Olga"]] as [string,string][]) {
    const hit = [...pool.values()].find(v => String(v.name).startsWith(name));
    if (!hit) { console.log("no:", name); continue; }
    const buf = await retry(async () => Buffer.from(await (await fetch(hit.preview_url,{headers:{"xi-api-key":KEY}})).arrayBuffer()));
    if (!buf) continue;
    await retry(() => uploadPublicObject({ key:`media/review/j014t6-${hit.voice_id}.mp3`, body:buf, contentType:"audio/mpeg" }));
    out.push({ code, id: hit.voice_id, name: hit.name, desc: hit.descriptive });
    console.log(`${code} ${String(hit.name).slice(0,30).padEnd(32)} ${hit.descriptive}`);
  }
  // Susana, la ya aprobada, para comparar en el mismo sitio
  out.push({ code:"S", id:"py37pY8QUQdhW5a7JwPG", name:"Susana - Documentary Voice", desc:"ya aprobada por ti" });
  writeFileSync(`${SP}/t6.json`, JSON.stringify(out));
})();
