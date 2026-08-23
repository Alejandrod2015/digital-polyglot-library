import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async()=>{
  for (const f of fs.readdirSync("src/data/tapGlosses").filter(x=>x.endsWith(".json"))) {
    const d=JSON.parse(fs.readFileSync(`src/data/tapGlosses/${f}`,"utf8"));
    const slugs:string[]=d.slugs??[];
    if(!slugs.length) continue;
    const vivos=await p.journeyStory.findMany({where:{slug:{in:slugs}},select:{slug:true}});
    const set=new Set(vivos.map(v=>v.slug));
    const muertos=slugs.filter(s=>!set.has(s));
    if(muertos.length) console.log(`${f.replace(".json","")}  ${muertos.length} muerto(s): ${muertos.join(", ")}`);
  }
  console.log("barrido terminado");
  await p.$disconnect();
})();
