import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async()=>{const s=await prisma.journeyStory.findFirst({where:{slug:"buergeramt-neukoelln-sieben-uhr"},select:{id:true,title:true,coverUrl:true}}) as any;
console.log("id:",s.id,"| title:",s.title,"| coverUrl:",s.coverUrl?"(tiene)":"(sin cover)");})().finally(()=>prisma.$disconnect());
