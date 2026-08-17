import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const rows=await p.journeyStory.findMany({where:{journeyId:"cmrdqk484000032r4rt2vw4ej"},select:{slug:true,audioUrl:true,audioStatus:true,audioSegments:true,dialogueSpec:true}});
  let withAudio=0, withDlg=0;
  const byStatus:Record<string,number>={};
  for(const r of rows){ if(r.audioUrl) withAudio++; if(r.dialogueSpec) withDlg++; byStatus[r.audioStatus||"null"]=(byStatus[r.audioStatus||"null"]||0)+1; }
  console.log("stories:",rows.length);
  console.log("with audioUrl (rendered narration audio):",withAudio);
  console.log("with dialogueSpec (voice map, prep for audio):",withDlg);
  console.log("audioStatus breakdown:",JSON.stringify(byStatus));
})().finally(()=>p.$disconnect());
