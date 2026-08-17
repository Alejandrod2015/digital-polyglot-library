import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{ const e=await p.storyPracticeExercise.findFirst({where:{word:"der Haken",set:{story:{slug:"im-keller-wohnt-die-hausordnung"}}},select:{payload:true}}); const ac=(e?.payload as any)?.audioClip; console.log("wordClipUrl:", ac?.wordClipUrl); console.log("wordVoiceId:", ac?.wordVoiceId); })().finally(()=>p.$disconnect());
