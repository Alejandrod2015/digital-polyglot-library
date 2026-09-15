// Revierte el efecto colateral de saveStory sobre audioFragments[0].text de
// alles-super-in-frankfurt (le quito el punto final del titulo). Solo ese campo.
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async()=>{
 const st:any = await prisma.journeyStory.findFirst({where:{slug:"alles-super-in-frankfurt", journeyId:"cmu0dqr6y0007j8o52i1s3gf7"}, select:{id:true,audioFragments:true}});
 const fr = [...st.audioFragments];
 const i = fr.findIndex((f:any)=>f.index===0);
 if (fr[i].text !== "Alles super in Frankfurt" || fr[i].renderedText !== "Alles super in Frankfurt.") { console.log("estado inesperado, no escribo", fr[i]); process.exit(1); }
 fr[i] = { ...fr[i], text: "Alles super in Frankfurt." };
 await prisma.journeyStory.update({ where:{id:st.id}, data:{ audioFragments: fr as never } });
 console.log("restaurado");
 await prisma.$disconnect();
})();
