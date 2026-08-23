import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { validateJourneyStories } from "../../src/lib/validateJourneyStories";
import fs from "fs";
const rows = JSON.parse(fs.readFileSync("scripts/_a1de/work.json","utf8"));
const ORDER=["food-everyday-life","home-family","meeting-new-people","places-getting-around","community-celebrations","nature-adventure","legends-folklore"];
rows.sort((a:any,b:any)=>(ORDER.indexOf(a.topic)-ORDER.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const todas = rows.map((r:any)=>({slug:r.slug,title:r.title,text:r.text,vocab:r.vocab,language:"DE",level:"a1"}));
const jc = validateJourneyStories(todas,{language:"DE",level:"a1",realPeople:[]});
console.log(JSON.stringify(jc.filter(c=>c.id.includes("introduction")),null,1));
// reparto: replicar el detector de linea de dialogo
const c=new Map<string,Set<string>>();
for(const s of todas){ for(const m of s.text.matchAll(/^([\p{Lu}][\p{Ll}]+):\s/gmu)){ if(!c.has(m[1]))c.set(m[1],new Set()); c.get(m[1])!.add(s.slug);} }
console.log("hablan>=2:", [...c].filter(([,v])=>v.size>=2).map(([k])=>k).join(", "));
