import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const LVL:any={a0:"Beginner",a1:"Elementary",a2:"Pre-Int",b1:"Intermediate",b2:"Upper-Int",c1:"Advanced",c2:"Mastery"};
(async () => {
  const journeys = await prisma.journey.findMany({ where:{ status:"active" }, select:{ id:true, name:true, language:true, variant:true, levels:true } }) as any[];
  const rows:any[]=[];
  for (const j of journeys) {
    const pub = await prisma.journeyStory.count({ where:{ journeyId:j.id, status:"published" } });
    const audio = await prisma.journeyStory.count({ where:{ journeyId:j.id, status:"published", audioStatus:"ready" } });
    const cover = await prisma.journeyStory.count({ where:{ journeyId:j.id, status:"published", coverUrl:{ not:null } } });
    let practice=0; try { practice = await prisma.journeyStory.count({ where:{ journeyId:j.id, status:"published", practiceSet:{ isNot:null } } }); } catch(e){ practice=-1; }
    const lv=(j.levels||[]).map((x:string)=>LVL[x]||x).join("/");
    rows.push({name:j.name,lang:j.language,variant:j.variant,lv,pub,audio,practice,cover});
  }
  rows.sort((a,b)=> (a.lang===b.lang?0:a.lang.localeCompare(b.lang)));
  console.log(`\n${"JOURNEY".padEnd(10)}${"IDIOMA".padEnd(9)}${"VAR".padEnd(9)}${"NIVEL".padEnd(12)}${"HIST".padEnd(6)}${"AUDIO".padEnd(8)}${"PRÁCT".padEnd(8)}COVER`);
  for(const r of rows) console.log(`${r.name.slice(0,9).padEnd(10)}${r.lang.slice(0,8).padEnd(9)}${(r.variant||"-").padEnd(9)}${r.lv.padEnd(12)}${String(r.pub).padEnd(6)}${(r.audio+"/"+r.pub).padEnd(8)}${(r.practice+"/"+r.pub).padEnd(8)}${r.cover}/${r.pub}`);
})().finally(() => prisma.$disconnect());
