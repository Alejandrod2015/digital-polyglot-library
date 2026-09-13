/** Solo lectura: dice que palabras candidatas ya ensena algun journey frances no archivado. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma"; const p = new PrismaClient();
const strip=(w:string)=>w.toLowerCase().replace(/^(le |la |les |l'|l’|un |une |se |s'|s’)/,"").trim();
async function main() {
  const js = await p.journey.findMany({ where:{ language:"french", status:{not:"archived"} }, select:{id:true,name:true,levels:true}});
  const taught = new Map<string,string>();
  for (const j of js) { const st = await p.journeyStory.findMany({where:{journeyId:j.id},select:{vocab:true,topic:true}}); for (const s of st) for (const v of (s.vocab as any[]??[])) taught.set(strip(v.word), `${j.name}${j.levels}${j.levels[0]==="a2"?":"+s.topic:""}`); }
  const cands = process.argv.slice(2).join(" ").split(",").map(s=>s.trim()).filter(Boolean);
  console.log("OCUPADAS:", cands.filter(c=>taught.has(strip(c))).map(c=>`${c}[${taught.get(strip(c))}]`).join(", "));
  console.log("LIBRES:", cands.filter(c=>!taught.has(strip(c))).join(", "));
  await p.$disconnect();
}
main();
