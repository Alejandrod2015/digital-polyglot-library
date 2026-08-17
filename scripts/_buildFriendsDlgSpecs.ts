import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p=new PrismaClient();
const V:Record<string,string>={ andreti:"JW8DGEuLp9WxIS5IdxMM", ana_sofia:"ewn5JTa3lNPY8QVuZJi6", ana_maria:"m7yTemJqdIqrcNleANfX", tom:"p1Q3ihQuPjyyENa1RGtl", emilio:"DV9FrN0pQkPWIoxW5dvT", patricio:"77K94gl6ZCRVTHG8Gi1w", esme:"dZtUsFRKkioPsu9syJF6", luna:"1ZhMG5ZZgJ6XpkOrB8Az", juan:"beQfcCW5PgdTQs4cETaz", carito:"J8BF9c7OgbHiqagCNoEj", valentina:"CUpuXTxjB4hhpAJNei6V", horacio:"57D8YIbQSuE3REDPO6Vm", roma:"6Mo5ciGH5nWiQacn5FYk", renzo:"acHf5gp7AGOY30tJjvD4", mariana:"9rvdnhrYoXoUt4igKpBw", sabina:"wnQAQM2xwHFeVXM7PQOq", terry:"ulJB4yAMefhHYn0FWgGy", joselo:"UK00oAtGYBrHBUbesfMv", catalina:"6Gr4AVmTax1pMJO0lHRK", vicente:"6WgXEzo1HGn3i7ilT4Fh", marco:"OFrdGXwCzoE56a9sp1fk" };
// topic -> {speakerDisplayName: voiceSlot}
const CAST:Record<string,Record<string,string>>={
 "el-cotorreo":{narrator:"andreti", "Mateo":"tom", "Sofía":"ana_sofia", "Renata":"ana_maria", "Pablo":"emilio"},
 "la-carrilla":{narrator:"andreti", "Rodrigo":"patricio", "Itzel":"ana_maria", "Nayeli":"esme"},
 "el-chisme":{narrator:"andreti", "Marina":"luna", "Julián":"juan", "Valeria":"carito"},
 "la-vacilada":{narrator:"andreti", "Daniela":"carito", "Andrés":"juan", "Yuly":"valentina", "Guachimán":"horacio"},
 "el-desahogo":{narrator:"andreti", "Camila":"roma", "Tomás":"renzo", "Flor":"mariana"},
 "la-jerga":{narrator:"andreti", "Pilar":"sabina", "Diego":"terry", "Beto":"joselo"},
 "el-weveo":{narrator:"andreti", "Benjamín":"vicente", "Javiera":"catalina", "Nico":"marco"},
};
(async()=>{
  const rows=await p.journeyStory.findMany({where:{journeyId:"cmrdqk484000032r4rt2vw4ej",NOT:{title:null}},select:{slug:true,topic:true,text:true}});
  const out:Record<string,any[]>={}; let problems=0;
  for(const r of rows as any[]){
    const cast=CAST[r.topic]; const lc:Record<string,string>={};
    for(const [k,v] of Object.entries(cast)) lc[k.toLowerCase()]=v as string;
    const SP=/^([A-Za-z\u00C0-\u017F]+):\s/; const spk=new Set<string>();
    for(const ln of (r.text as string).split(/\r?\n/)){ if(!ln.trim())continue; const m=ln.match(SP); spk.add(m?m[1]:"narrator"); }
    const speakers=[...spk];
    const spec:any[]=[]; const missing:string[]=[];
    for(const sp of speakers){ const slot=lc[sp.toLowerCase()]; if(!slot){missing.push(sp);continue;} spec.push({speaker:sp, voice:V[slot]}); }
    const distinct=new Set(spec.map(s=>s.voice)).size;
    if(missing.length||distinct<2){ problems++; console.log(`✗ ${r.slug}: missing=[${missing}] distinctVoices=${distinct} speakers=[${speakers}]`); }
    else out[r.slug]=spec;
  }
  fs.writeFileSync("scripts/_friends_dialoguespecs.json", JSON.stringify(out,null,1));
  console.log(`\n${Object.keys(out).length}/21 specs ok, ${problems} problems. wrote _friends_dialoguespecs.json`);
})().finally(()=>p.$disconnect());
