import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const ANDRETI="JW8DGEuLp9WxIS5IdxMM";
const SLUGS=["le-toca-a-mateo","ahorita-salgo","diez-intentos"];
(async()=>{
  for(const slug of SLUGS){
    const r=await p.journeyStory.findFirst({where:{slug},select:{id:true,audioUrl:true}});
    if(!r){ console.log("NO row",slug); continue; }
    const had=!!r.audioUrl;
    await p.journeyStory.update({where:{id:r.id},data:{
      audioUrl:null, audioFilename:null, audioStatus:"pending",
      audioSegments:undefined as any, audioWordTimings:undefined as any,
      audioUrlPreview:null, audioFilenamePreview:null,
      audioQaStatus:null, audioQaScore:null, audioQaNotes:null,
      voiceId:ANDRETI,
      dialogueSpec:[{speaker:"narrator", voice:ANDRETI}] as any,
    }});
    console.log(`${slug}: audio limpiado${had?" (tenía audio viejo multivoz)":""}, dialogueSpec -> narrador/andreti`);
  }
})().finally(()=>p.$disconnect());
