/** Cuanto de los 21 cuerpos del A1 ya esta glosado por los dos paquetes italianos. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const TOK=/\p{L}+(?:['’]\p{L}+)?/gu;
async function run(){
  const id="cmt5wqsf7000032ghesowd0jy";
  const rows=await prisma.journeyStory.findMany({where:{journeyId:id},select:{slug:true,text:true}});
  const toks=new Set<string>();
  for(const r of rows) for(const m of (r.text??"").toLowerCase().matchAll(TOK)) toks.add(m[0].normalize("NFC"));
  const base:Record<string,any>={};
  for (const f of ["italian-traveler-a0","italian-friends-a0"]) {
    const b=JSON.parse(fs.readFileSync(`src/data/tapGlosses/${f}.json`,"utf8"));
    for(const [k,v] of Object.entries(b.glosses)) if(!base[k]) base[k]=v;
    console.log(`${f}: ${Object.keys(b.glosses).length} glosas · ${b.slugs.length} slugs`);
  }
  const faltan=[...toks].filter(t=>!base[t]).sort();
  console.log(`\ntokens del A1: ${toks.size} · ya glosados: ${toks.size-faltan.length} (${(100*(toks.size-faltan.length)/toks.size).toFixed(0)}%) · faltan ${faltan.length}`);
  fs.writeFileSync("scripts/_itA1/glosas_faltan.json", JSON.stringify(faltan,null,1));
  console.log(faltan.join(" "));
  await prisma.$disconnect();
}
run();
