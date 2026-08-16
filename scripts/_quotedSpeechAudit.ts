import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const COMILLAS = /[«»""„"']|(^|\n)\s*[-—–]\s+\S/;
(async()=>{
  const js = await p.journey.findMany({ where:{ status:{ notIn:["archived","draft"] } }, select:{ id:true, name:true, language:true, variant:true, levels:true } });
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where:{ journeyId:j.id, status:"published" }, select:{ text:true } });
    // Prosa narrada = sin líneas "Personaje: ..." al principio de línea.
    const narradas = st.filter(s => !/^\s*[A-ZÁÉÍÓÚÑ][\wáéíóúñç' ]{1,20}:\s/m.test(s.text ?? ""));
    const conVoz = narradas.filter(s => COMILLAS.test(s.text ?? ""));
    console.log(`${(j.language+"/"+j.variant).padEnd(20)} ${j.levels.join(",").padEnd(4)} ${j.name.padEnd(10)} narradas ${String(narradas.length).padStart(2)}/${st.length} · con habla citada ${String(conVoz.length).padStart(2)}/${narradas.length}`);
  }
})().finally(()=>p.$disconnect());
