import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
// Journey ES C1 LATAM "Friends": 7 registros de conversación entre amigos,
// cada tema ancla una variedad regional distinta (project_journey_es_c1_friends).
const TOPICS = [
  "el-cotorreo",   // 1 Chilango (CDMX)
  "la-carrilla",   // 2 Oaxaqueño
  "el-chisme",     // 3 Rolo (Bogotá)
  "la-vacilada",   // 4 Costeño (Cartagena)
  "el-desahogo",   // 5 Porteño (Buenos Aires)
  "la-jerga",      // 6 Limeño (Lima)
  "el-weveo",      // 7 Chileno (Patagonia)
];
(async()=>{
  const p=new PrismaClient();
  const dup=await p.journey.findFirst({where:{language:"spanish",variant:"latam",name:"Friends"}});
  if(dup){ console.log("ya existe:",dup.id); console.log("FRIENDS_ID="+dup.id); await p.$disconnect(); return; }
  const j=await p.journey.create({data:{ name:"Friends", language:"spanish", variant:"latam", levels:["c1"], topics:TOPICS, storiesPerTopic:3, status:"archived" }});
  let n=0;
  for(const topic of TOPICS){ for(let slot=1;slot<=3;slot++){ await p.journeyStory.create({data:{journeyId:j.id, level:"c1", topic, slotIndex:slot, status:"draft"}}); n++; } }
  console.log(`created journey ${j.id} with ${n} slots (archived)`);
  console.log("FRIENDS_ID="+j.id);
  await p.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
