import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { multiVoiceGuardError } from "../src/lib/multiVoiceGuard";
async function run(){
  const slug=process.argv[2]; if(!slug){console.error("uso: <slug>");process.exit(1);}
  const prisma=new PrismaClient();
  const story=await prisma.journeyStory.findFirst({ where:{slug}, include:{journey:true}});
  if(!story||!story.text||!story.title){console.error("not found / missing text");process.exit(1);}
  if(story.audioUrl){console.error(`[${slug}] YA tiene audioUrl, aborto: ${story.audioUrl}`);process.exit(1);}
  const g=multiVoiceGuardError({storyText:story.text,dialogueSpec:story.dialogueSpec});
  if(g){console.error("guard:",g);process.exit(1);}
  const spec=story.dialogueSpec as Array<{speaker:string,voice:string,text:string}>|null;
  if(!Array.isArray(spec)||!spec.length){console.error("no spec");process.exit(1);}
  const voiceMap:Record<string,string>={}; for(const s of spec) if(s.speaker&&s.voice) voiceMap[s.speaker.toLowerCase()]=s.voice;
  console.log(`[${slug}] voices:`,voiceMap);
  await prisma.journeyStory.update({where:{id:story.id},data:{audioStatus:"generating"}});
  const r=await generateAndUploadMultiVoiceAudio({storyText:story.text,title:story.title,voiceMap,language:story.journey.language??undefined,disableStitching:true});
  if(!r)throw new Error("null result");
  await prisma.journeyStory.update({where:{id:story.id},data:{
    audioUrl:r.url,audioSegments:r.audioSegments as any,audioFilename:r.filename,audioStatus:"ready",
    voiceId:r.speakerVoiceMap?.narrator??voiceMap.narrator??null,
    audioQaStatus:r.audioQa?.status??null,audioQaScore:r.audioQa?.score??null,audioQaNotes:r.audioQa?.notes?.join("\n")??null,
    ...(r.fragments?.length?{audioFragments:r.fragments as object}:{}),
  }});
  console.log(`[${slug}] dry master: ${r.url}`);
  try{await generateWordTimingsForStory(story.id);console.log(`[${slug}] alignment OK`);}catch(e:any){console.warn(`[${slug}] alignment failed: ${e.message?.slice(0,100)}`);}
  await prisma.$disconnect();
  console.log(`[${slug}] DONE (dry, pre-pace)`);
}
run().catch(e=>{console.error("FATAL",e.message);process.exit(1);});
