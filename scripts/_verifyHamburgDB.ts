import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const TOPICS=["ankommen-im-norden","wohnen-in-der-hansestadt","das-kontor","hanseatische-formen","alltag-an-der-elbe","vereine-und-freundschaft","sturm-und-gesundheit"];
(async()=>{
  const rows=await p.journeyStory.findMany({where:{journeyId:"cmrdbz11t000032asrvo832i9", NOT:{title:null}}, select:{slug:true,title:true,topic:true,slotIndex:true,text:true}});
  rows.sort((a:any,b:any)=>TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic)||a.slotIndex-b.slotIndex);
  rows.forEach((r:any,i:number)=>console.log(`${String(i+1).padStart(2)} ${r.slug}`));
  const fix1=rows.find((r:any)=>r.slug==="understatement-verkauft");
  const fix2=rows.find((r:any)=>r.slug==="grog-gegen-alles");
  const rw=rows.find((r:any)=>r.slug==="wenn-das-wasser-kehrt");
  console.log("\nfix#8 'einen einzigen Superlativ':", fix1?.text.includes("ohne einen einzigen Superlativ"));
  console.log("fix#8 viejo error ausente:", !fix1?.text.includes("ohne ein einziges Superlativ"));
  console.log("fix#20 'beim Arzt um einen Termin':", fix2?.text.includes("beim Arzt um einen Termin betteln"));
  console.log("#19 rewrite presente (nicht Orkan):", rw && !rw.text.includes("Orkan"), "| titulo:", rw?.title);
})().finally(()=>p.$disconnect());
