import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const j = await p.journey.findFirst({ where:{ id:"cmsou2uk0000732mqa4oatcmn" }, select:{ topics:true } });
  const st = await p.journeyStory.findMany({
    where:{ journeyId:"cmsou2uk0000732mqa4oatcmn" },
    select:{ topic:true, slotIndex:true, title:true, status:true, audioUrl:true, audioFragments:true, coverUrl:true, wordCount:true, vocabCount:true },
  });
  const orden=(j?.topics??[]).map(t=>t.toLowerCase());
  st.sort((a,b)=>(orden.indexOf(a.topic)-orden.indexOf(b.topic))||a.slotIndex-b.slotIndex);
  const rev = JSON.parse(require("fs").readFileSync("scripts/_ptAudioReview.json","utf8")).historias as Record<string,{revisado:string|null;hallazgo:string|null;estado?:string;corregido:boolean}>;
  const slugs = await p.journeyStory.findMany({ where:{ journeyId:"cmsou2uk0000732mqa4oatcmn" }, select:{ topic:true, slotIndex:true, slug:true } });
  const slugDe = new Map(slugs.map(x=>[`${x.topic}#${x.slotIndex}`, x.slug ?? ""]));
  console.log("Tema|#|Título|Audio|Frag|Revisión|Hallazgo|Corregido");
  for (const s of st) {
    const fr = Array.isArray(s.audioFragments) ? (s.audioFragments as unknown[]).length : 0;
    const r = rev[slugDe.get(`${s.topic}#${s.slotIndex}`) ?? ""] ?? { revisado:null, hallazgo:null, corregido:false };
    const revisión = !r.revisado ? "SIN REVISAR" : !r.hallazgo || r.estado === "falso positivo" ? "limpia" : r.estado === "confirmado" ? "defecto confirmado" : "defecto detectado";
    console.log([s.topic, s.slotIndex, s.title ?? "-", s.audioUrl?"sí":"NO", fr||"NO", revisión, r.hallazgo ?? "-", r.corregido?"sí":"no"].join("|"));
  }
})().finally(()=>p.$disconnect());
